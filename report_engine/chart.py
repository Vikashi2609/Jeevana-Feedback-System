"""
chart.py — chart generation for teacher evaluation reports (v2, polished)
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

# ---- Brand palette -----------------------------------------------------
NAVY   = "#1B3A5C"
GOLD   = "#D9A441"
GRID   = "#E4E7EB"
TEXT   = "#33404D"

RATING_COLORS = {
    1: "#C1554A",   # muted red
    2: "#E19A3C",   # amber-orange
    3: "#F0C55E",   # gold-yellow
    4: "#8FB99B",   # sage green
    5: "#3E8E70",   # deep teal-green
}

plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "text.color": TEXT,
    "axes.edgecolor": GRID,
    "axes.labelcolor": TEXT,
    "xtick.color": TEXT,
    "ytick.color": TEXT,
})


def average_rating_chart(question_averages, out_path, question_labels=None):
    """
    Horizontal bar chart of the AVERAGE rating per question (0-5 scale).
    question_averages: list/array of floats, one per question, in order.
    """
    n = len(question_averages)
    labels = question_labels or [f"Q{i+1}" for i in range(n)]
    values = np.array(question_averages, dtype=float)

    fig_h = 0.42 * n + 1.1
    fig, ax = plt.subplots(figsize=(7.6, fig_h), dpi=200)

    y = np.arange(n)
    colors = [GOLD if v >= 4 else (NAVY if v >= 3 else "#C1554A") for v in values]
    bars = ax.barh(y, values, color=colors, height=0.58, zorder=3)

    for bar, v in zip(bars, values):
        ax.text(v + 0.08, bar.get_y() + bar.get_height() / 2, f"{v:.1f}",
                va="center", ha="left", fontsize=9, color=TEXT, fontweight="bold")

    ax.set_yticks(y)
    ax.set_yticklabels(labels, fontsize=9.5)
    ax.invert_yaxis()
    ax.set_xlim(0, 5.6)
    ax.set_xticks([0, 1, 2, 3, 4, 5])
    ax.set_xlabel("Average rating (out of 5)", fontsize=9, labelpad=6)
    ax.grid(axis="x", color=GRID, linewidth=0.8, zorder=0)
    ax.set_axisbelow(True)
    for spine in ["top", "right", "left"]:
        ax.spines[spine].set_visible(False)
    ax.spines["bottom"].set_color(GRID)
    ax.axvline(4, color=GRID, linewidth=1, linestyle="--", zorder=1)

    fig.tight_layout(pad=0.6)
    fig.savefig(out_path, transparent=True)
    plt.close(fig)
    return out_path


def distribution_chart(distribution, out_path, question_labels=None):
    """
    Stacked horizontal bar chart: for each question, share of 1-5 ratings.
    distribution: list of dicts like {5: n, 4: n, 3: n, 2: n, 1: n}, one per question.
    """
    n = len(distribution)
    labels = question_labels or [f"Q{i+1}" for i in range(n)]
    totals = [sum(d.values()) or 1 for d in distribution]

    fig_h = 0.42 * n + 1.3
    fig, ax = plt.subplots(figsize=(7.6, fig_h), dpi=200)

    y = np.arange(n)
    left = np.zeros(n)
    for rating in [1, 2, 3, 4, 5]:
        widths = np.array([distribution[i].get(rating, 0) / totals[i] * 100 for i in range(n)])
        ax.barh(y, widths, left=left, color=RATING_COLORS[rating], height=0.58,
                label=str(rating), zorder=3,
                edgecolor="white", linewidth=0.6)
        left += widths

    ax.set_yticks(y)
    ax.set_yticklabels(labels, fontsize=9.5)
    ax.invert_yaxis()
    ax.set_xlim(0, 100)
    ax.set_xlabel("Share of responses (%)", fontsize=9, labelpad=6)
    ax.grid(axis="x", color=GRID, linewidth=0.8, zorder=0)
    ax.set_axisbelow(True)
    for spine in ["top", "right", "left"]:
        ax.spines[spine].set_visible(False)

    handles, lbls = ax.get_legend_handles_labels()
    ax.legend(handles[::-1], lbls[::-1], title="Rating", bbox_to_anchor=(1.01, 1),
              loc="upper left", frameon=False, fontsize=8, title_fontsize=8.5)

    fig.tight_layout(pad=0.6)
    fig.savefig(out_path, transparent=True, bbox_inches="tight")
    plt.close(fig)
    return out_path
