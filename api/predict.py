"""
Vercel Python serverless function: football matchup prediction.

Supports Premier League, La Liga, Bundesliga, Serie A, and Ligue 1.
Each league has its own trained model stored in api/_data/{league}/.
Data is cached in module-level dicts so warm containers skip disk reads.
"""
import json
import os
from http.server import BaseHTTPRequestHandler

import numpy as np
import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_data")

VALID_LEAGUES = {"pl", "laliga", "bundesliga", "seriea", "ligue1"}
OUTCOME_NAMES = {"H": "Home win", "D": "Draw", "A": "Away win"}

# Per-league cache: { league_id: (model, snapshots, matches_df) }
_CACHE: dict[str, tuple[dict, dict, pd.DataFrame]] = {}


def _load_league(league: str) -> tuple[dict, dict, pd.DataFrame]:
    if league in _CACHE:
        return _CACHE[league]
    d = os.path.join(DATA_DIR, league)
    with open(os.path.join(d, "model.json")) as f:
        model = json.load(f)
    with open(os.path.join(d, "snapshots.json")) as f:
        snapshots = json.load(f)
    with open(os.path.join(d, "matches.json")) as f:
        matches = pd.DataFrame(json.load(f))
    _CACHE[league] = (model, snapshots, matches)
    return model, snapshots, matches


def _feature_vector(home: dict, away: dict) -> np.ndarray:
    return np.array([
        home["ppg_l5"], away["ppg_l5"],
        home["ppg_l10"], away["ppg_l10"],
        home["gf_l5"], home["ga_l5"],
        away["gf_l5"], away["ga_l5"],
        home["rest_days"], away["rest_days"],
        home["ppg_l5"] - away["ppg_l5"],
        home["gf_l5"] - away["gf_l5"],
    ], dtype=float)


def _softmax(logits: np.ndarray) -> np.ndarray:
    exp = np.exp(logits - np.max(logits))
    return exp / exp.sum()


def _explain(feature: str, impact: float, home_name: str, away_name: str,
             h: dict, a: dict) -> str:
    supports = impact > 0

    def v(snap, key):
        val = snap.get(key)
        return f"{val:.1f}" if val is not None else "?"

    lines = {
        "home_ppg_l5":
            f"{home_name} are averaging {v(h,'ppg_l5')} points per game over their last 5 matches. "
            + ("That consistent home form supports a win here."
               if supports else "That form doesn't inspire much confidence at home."),
        "away_ppg_l5":
            f"{away_name} are averaging {v(a,'ppg_l5')} points per game over their last 5. "
            + ("Their away form has dipped, which favors the home side."
               if supports else "That strong recent form makes them a real threat on the road."),
        "home_ppg_l10":
            f"{home_name} have averaged {v(h,'ppg_l10')} points per game over their last 10 matches. "
            + ("Solid longer-term form backs up a home win."
               if supports else "Their inconsistency over the last 10 games is a concern."),
        "away_ppg_l10":
            f"{away_name} have averaged {v(a,'ppg_l10')} points per game over their last 10. "
            + ("Their away struggles over that stretch help the home side."
               if supports else "That strong long-term record closes the gap significantly."),
        "home_gf_l5":
            f"{home_name} have scored {v(h,'gf_l5')} goals per game over their last 5. "
            + ("A sharp attack increases their chances at home."
               if supports else "Misfiring in front of goal makes a home win harder to come by."),
        "home_ga_l5":
            f"{home_name} have conceded {v(h,'ga_l5')} goals per game recently. "
            + ("A tight defense at home is a big advantage."
               if supports else "Conceding freely at home is a problem against quality opposition."),
        "away_gf_l5":
            f"{away_name} have scored {v(a,'gf_l5')} goals per game on the road recently. "
            + ("A muted attack away from home reduces their threat."
               if supports else "Scoring freely on the road makes them dangerous."),
        "away_ga_l5":
            f"{away_name} have conceded {v(a,'ga_l5')} goals per game on the road. "
            + (f"Defensive fragility away from home gives {home_name} an opening."
               if supports else f"A solid away defense will make it difficult for {home_name}."),
        "home_rest_days":
            f"{home_name} have had {int(h.get('rest_days', 0))} days since their last match. "
            + ("Fresh legs at home is an advantage."
               if supports else "Fatigue could be a factor for the home side."),
        "away_rest_days":
            f"{away_name} have had {int(a.get('rest_days', 0))} days since their last match before travelling. "
            + ("Less recovery time on the road is a disadvantage for the visitors."
               if supports else "They arrive well-rested, which helps away sides."),
        "ppg_diff_l5":
            f"The recent form gap: {home_name} at {v(h,'ppg_l5')} vs {away_name} at {v(a,'ppg_l5')} points per game. "
            + ("The form advantage is clearly with the home side."
               if supports else "The gap actually favors the visitors right now."),
        "gf_diff_l5":
            f"Attacking output: {home_name} scoring {v(h,'gf_l5')} vs {away_name} scoring {v(a,'gf_l5')} goals per game. "
            + ("The home side has the sharper attack."
               if supports else "The away side's attack has been more potent recently."),
    }
    return lines.get(feature, feature)


def _verdict(home: str, away: str, hp: float, dp: float, ap: float) -> str:
    margin = abs(hp - ap)
    if hp > ap and hp > dp:
        strength = "strong favorites" if margin > 0.20 else "slight favorites"
        return f"{home} are {strength} at home."
    if ap > hp and ap > dp:
        strength = "strong favorites" if margin > 0.20 else "slight favorites"
        return f"{away} are {strength} despite playing away."
    return "This matchup is very close. A draw is firmly on the cards."


def _head_to_head(home: str, away: str, matches: pd.DataFrame) -> dict:
    mask = (
        ((matches["home"] == home) & (matches["away"] == away))
        | ((matches["home"] == away) & (matches["away"] == home))
    )
    sub = matches[mask].sort_values("date", ascending=False).head(8)
    home_wins = draws = away_wins = 0
    result_matches = []
    for _, r in sub.iterrows():
        ftr = r["ftr"]
        if ftr == "D":
            draws += 1
        elif (r["home"] == home and ftr == "H") or (r["home"] == away and ftr == "A"):
            home_wins += 1
        else:
            away_wins += 1
        result_matches.append({
            "date": r["date"], "home": r["home"], "away": r["away"],
            "fthg": int(r["fthg"]), "ftag": int(r["ftag"]), "ftr": ftr,
        })
    return {"homeWins": home_wins, "draws": draws, "awayWins": away_wins, "matches": result_matches}


def compute_prediction(home: str, away: str, league: str = "pl") -> dict:
    model, snapshots, matches = _load_league(league)

    if home not in snapshots:
        raise ValueError(f"No form data for '{home}' in {league}")
    if away not in snapshots:
        raise ValueError(f"No form data for '{away}' in {league}")
    if home == away:
        raise ValueError("Pick two different teams")

    h, a = snapshots[home], snapshots[away]
    x = _feature_vector(h, a)
    mean = np.array(model["scaler"]["mean"])
    scale = np.array(model["scaler"]["scale"])
    scaled = (x - mean) / scale

    coef = np.array(model["coef"])
    intercept = np.array(model["intercept"])
    probs = _softmax(scaled @ coef.T + intercept)

    labels = model["labels"]
    pred_idx = int(np.argmax(probs))
    prob_map = {labels[i]: float(probs[i]) for i in range(len(labels))}

    contributions = coef[pred_idx] * scaled
    features = model["features"]
    order = np.argsort(-np.abs(contributions))[:5]
    drivers = [{
        "feature": features[i],
        "impact": round(float(contributions[i]), 4),
        "explanation": _explain(features[i], float(contributions[i]), home, away, h, a),
    } for i in order]

    hp, dp, ap = prob_map["H"], prob_map["D"], prob_map["A"]
    return {
        "home": home, "away": away,
        "probabilities": {"home": hp, "draw": dp, "away": ap},
        "predicted": OUTCOME_NAMES[labels[pred_idx]],
        "verdict": _verdict(home, away, hp, dp, ap),
        "homeForm": h, "awayForm": a,
        "drivers": drivers,
        "h2h": _head_to_head(home, away, matches),
    }


class handler(BaseHTTPRequestHandler):
    def _send(self, status: int, payload: dict):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length > 4096:
                self._send(413, {"error": "Request too large"})
                return
            raw = self.rfile.read(length).decode("utf-8", errors="ignore") if length else "{}"
            payload = json.loads(raw)
            home = str(payload.get("home", ""))[:64]
            away = str(payload.get("away", ""))[:64]
            league = str(payload.get("league", "pl"))[:20]
            if league not in VALID_LEAGUES:
                self._send(400, {"error": f"Unknown league: {league}"})
                return
            result = compute_prediction(home, away, league)
            self._send(200, result)
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send(400, {"error": "Invalid request body"})
        except ValueError as exc:
            self._send(400, {"error": str(exc)})
        except Exception:  # noqa: BLE001
            self._send(500, {"error": "Prediction failed"})


if __name__ == "__main__":
    import sys
    league_arg = sys.argv[3] if len(sys.argv) > 3 else "pl"
    h, a = (sys.argv[1], sys.argv[2]) if len(sys.argv) > 2 else ("Arsenal", "Chelsea")
    print(json.dumps(compute_prediction(h, a, league_arg), indent=2))
