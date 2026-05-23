"""
Vercel Python serverless function: Premier League matchup prediction.

Loads the exported logistic-regression coefficients and runs the prediction
with numpy. Head-to-head history is computed with pandas. Training stays in
the separate data-science repo; this only serves the trained model.
"""
import json
import os
from http.server import BaseHTTPRequestHandler

import numpy as np
import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_data")


def _load(name: str):
    with open(os.path.join(DATA_DIR, name)) as f:
        return json.load(f)


# Loaded once per warm container.
MODEL = _load("model.json")
SNAPSHOTS = _load("snapshots.json")
MATCHES = pd.DataFrame(_load("matches.json"))

OUTCOME_NAMES = {"H": "Home win", "D": "Draw", "A": "Away win"}


def _feature_vector(home: dict, away: dict) -> np.ndarray:
    """Build the 12-feature vector in the exact order the model was trained on."""
    return np.array([
        home["ppg_l5"],
        away["ppg_l5"],
        home["ppg_l10"],
        away["ppg_l10"],
        home["gf_l5"],
        home["ga_l5"],
        away["gf_l5"],
        away["ga_l5"],
        home["rest_days"],
        away["rest_days"],
        home["ppg_l5"] - away["ppg_l5"],
        home["gf_l5"] - away["gf_l5"],
    ], dtype=float)


def _softmax(logits: np.ndarray) -> np.ndarray:
    shifted = logits - np.max(logits)
    exp = np.exp(shifted)
    return exp / exp.sum()


def _explain(feature: str, impact: float, home_name: str, away_name: str,
             h: dict, a: dict) -> str:
    """Plain-English reason for a prediction driver (ported from the Streamlit app)."""
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


def _head_to_head(home: str, away: str) -> dict:
    df = MATCHES
    mask = (
        ((df["home"] == home) & (df["away"] == away))
        | ((df["home"] == away) & (df["away"] == home))
    )
    sub = df[mask].sort_values("date", ascending=False).head(8)

    home_wins = draws = away_wins = 0
    matches = []
    for _, r in sub.iterrows():
        ftr = r["ftr"]
        if ftr == "D":
            draws += 1
        elif (r["home"] == home and ftr == "H") or (r["home"] == away and ftr == "A"):
            home_wins += 1
        else:
            away_wins += 1
        matches.append({
            "date": r["date"],
            "home": r["home"],
            "away": r["away"],
            "fthg": int(r["fthg"]),
            "ftag": int(r["ftag"]),
            "ftr": ftr,
        })
    return {"homeWins": home_wins, "draws": draws, "awayWins": away_wins, "matches": matches}


def compute_prediction(home: str, away: str) -> dict:
    if home not in SNAPSHOTS:
        raise ValueError(f"No form data for {home}")
    if away not in SNAPSHOTS:
        raise ValueError(f"No form data for {away}")
    if home == away:
        raise ValueError("Pick two different teams")

    h = SNAPSHOTS[home]
    a = SNAPSHOTS[away]

    x = _feature_vector(h, a)
    mean = np.array(MODEL["scaler"]["mean"])
    scale = np.array(MODEL["scaler"]["scale"])
    scaled = (x - mean) / scale

    coef = np.array(MODEL["coef"])          # (3, 12)
    intercept = np.array(MODEL["intercept"])  # (3,)
    logits = scaled @ coef.T + intercept
    probs = _softmax(logits)

    labels = MODEL["labels"]                # ["H", "D", "A"]
    pred_idx = int(np.argmax(probs))
    prob_map = {labels[i]: float(probs[i]) for i in range(len(labels))}

    # Drivers: per-feature contribution to the predicted class.
    contributions = coef[pred_idx] * scaled
    features = MODEL["features"]
    order = np.argsort(-np.abs(contributions))[:5]
    drivers = [{
        "feature": features[i],
        "impact": round(float(contributions[i]), 4),
        "explanation": _explain(features[i], float(contributions[i]), home, away, h, a),
    } for i in order]

    hp, dp, ap = prob_map["H"], prob_map["D"], prob_map["A"]

    return {
        "home": home,
        "away": away,
        "probabilities": {"home": hp, "draw": dp, "away": ap},
        "predicted": OUTCOME_NAMES[labels[pred_idx]],
        "verdict": _verdict(home, away, hp, dp, ap),
        "homeForm": h,
        "awayForm": a,
        "drivers": drivers,
        "h2h": _head_to_head(home, away),
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
            result = compute_prediction(home, away)
            self._send(200, result)
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send(400, {"error": "Invalid request body"})
        except ValueError as exc:
            self._send(400, {"error": str(exc)})
        except Exception:  # noqa: BLE001
            self._send(500, {"error": "Prediction failed"})


if __name__ == "__main__":
    # Local smoke test: python api/predict.py
    import sys
    h, a = (sys.argv[1], sys.argv[2]) if len(sys.argv) > 2 else ("Arsenal", "Chelsea")
    print(json.dumps(compute_prediction(h, a), indent=2))
