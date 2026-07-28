"""
pdf_report.py — polished executive PDF report (v2)

Generates a 2-3 page executive PDF per teacher:
  Page 1: Header band, key-stat cards, classes table, overall question ratings
  Page 2: Full question distribution table + stacked distribution chart
  Page 3: Comments grouped by class

This is a self-contained DEMO built from the sample values in
Ms_Karthika_Report.pdf so you can see the visual upgrade. Swap `build_report()`'s
input for whatever `processor.py` returns and it will work unchanged, since the
expected shape is documented at the top of that function.
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    Image, NextPageTemplate, PageBreak, HRFlowable, KeepTogether
)
from reportlab.pdfgen import canvas as pdfcanvas

from chart import average_rating_chart, distribution_chart, NAVY, GOLD, TEXT

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm

LIGHT_BG = colors.HexColor("#F4F6F8")
NAVY_C = colors.HexColor(NAVY)
GOLD_C = colors.HexColor(GOLD)
TEXT_C = colors.HexColor(TEXT)
MUTED_C = colors.HexColor("#6B7684")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle("SchoolName", parent=styles["Normal"], fontName="Helvetica-Bold",
                           fontSize=15, textColor=colors.white, leading=18))
styles.add(ParagraphStyle("ReportTag", parent=styles["Normal"], fontName="Helvetica",
                           fontSize=9.5, textColor=colors.HexColor("#CBD8E6"), leading=12))
styles.add(ParagraphStyle("TeacherName", parent=styles["Normal"], fontName="Helvetica-Bold",
                           fontSize=20, textColor=NAVY_C, leading=24, spaceAfter=2))
styles.add(ParagraphStyle("Subtitle", parent=styles["Normal"], fontName="Helvetica",
                           fontSize=10, textColor=MUTED_C, leading=13))
styles.add(ParagraphStyle("SectionHeading", parent=styles["Normal"], fontName="Helvetica-Bold",
                           fontSize=12, textColor=NAVY_C, spaceBefore=14, spaceAfter=6))
styles.add(ParagraphStyle("StatNumber", parent=styles["Normal"], fontName="Helvetica-Bold",
                           fontSize=22, textColor=NAVY_C, alignment=TA_CENTER, leading=24))
styles.add(ParagraphStyle("StatLabel", parent=styles["Normal"], fontName="Helvetica",
                           fontSize=8.5, textColor=MUTED_C, alignment=TA_CENTER, leading=11))
styles.add(ParagraphStyle("ClassCardHeader", parent=styles["Normal"], fontName="Helvetica-Bold",
                           fontSize=10.5, textColor=colors.white, leading=13))
styles.add(ParagraphStyle("Comment", parent=styles["Normal"], fontName="Helvetica",
                           fontSize=9.5, textColor=TEXT_C, leading=13, leftIndent=2))
styles.add(ParagraphStyle("FooterText", parent=styles["Normal"], fontName="Helvetica",
                           fontSize=7.5, textColor=MUTED_C))


# --------------------------------------------------------------------------
# Page chrome: header band + footer, drawn on every page via onPage callback
# --------------------------------------------------------------------------
def _draw_chrome(canv: pdfcanvas.Canvas, doc, teacher_name, subject_line, school_name="JEEVANA SCHOOL"):
    canv.saveState()

    # Top navy band
    band_h = 24 * mm
    canv.setFillColor(NAVY_C)
    canv.rect(0, PAGE_H - band_h, PAGE_W, band_h, stroke=0, fill=1)
    # thin gold accent rule under the band
    canv.setFillColor(GOLD_C)
    canv.rect(0, PAGE_H - band_h - 1.2 * mm, PAGE_W, 1.2 * mm, stroke=0, fill=1)

    canv.setFillColor(colors.white)
    canv.setFont("Helvetica-Bold", 14)
    canv.drawString(MARGIN, PAGE_H - 14 * mm, school_name)
    canv.setFont("Helvetica", 8.5)
    canv.setFillColor(colors.HexColor("#CBD8E6"))
    canv.drawString(MARGIN, PAGE_H - 19.5 * mm, "Teacher Evaluation Report")

    canv.setFont("Helvetica-Bold", 10.5)
    canv.setFillColor(colors.white)
    canv.drawRightString(PAGE_W - MARGIN, PAGE_H - 14 * mm, teacher_name)
    canv.setFont("Helvetica", 8.5)
    canv.setFillColor(colors.HexColor("#CBD8E6"))
    canv.drawRightString(PAGE_W - MARGIN, PAGE_H - 19.5 * mm, subject_line)

    # Footer
    canv.setFillColor(MUTED_C)
    canv.setFont("Helvetica", 7.5)
    canv.drawString(MARGIN, 10 * mm, "Jeevana School  ·  Confidential — for internal use only")
    canv.drawRightString(PAGE_W - MARGIN, 10 * mm, f"Page {doc.page}")
    canv.setStrokeColor(colors.HexColor("#DADFE3"))
    canv.line(MARGIN, 13 * mm, PAGE_W - MARGIN, 13 * mm)

    canv.restoreState()


def _stat_card(number_text, label_text, accent=NAVY_C):
    t = Table(
        [[Paragraph(number_text, styles["StatNumber"])],
         [Paragraph(label_text.upper(), styles["StatLabel"])]],
        colWidths=[52 * mm],
    )
    t.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#E2E6EA")),
        ("LINEABOVE", (0, 0), (-1, 0), 2.4, accent),
        ("TOPPADDING", (0, 0), (-1, 0), 10),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
        ("TOPPADDING", (0, 1), (-1, 1), 0),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 10),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
    ]))
    return t


def _classes_table(classes):
    header = ["Class", "Section", "Subject", "Responses"]
    rows = [header] + [[c["class"], c["section"], c["subject"], str(c["responses"])] for c in classes]
    t = Table(rows, colWidths=[28 * mm, 28 * mm, 65 * mm, 30 * mm], hAlign="LEFT")
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY_C),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("TEXTCOLOR", (0, 1), (-1, -1), TEXT_C),
        ("ALIGN", (3, 0), (3, -1), "CENTER"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E6EA")),
    ]
    for i in range(1, len(rows)):
        if i % 2 == 0:
            style.append(("BACKGROUND", (0, i), (-1, i), LIGHT_BG))
    t.setStyle(TableStyle(style))
    return t


def _distribution_table(distribution, question_labels):
    header = ["Q", "5", "4", "3", "2", "1", "Avg"]
    rows = [header]
    for i, d in enumerate(distribution):
        total = sum(d.values()) or 1
        avg = sum(r * d.get(r, 0) for r in range(1, 6)) / total
        rows.append([question_labels[i], d.get(5, 0), d.get(4, 0), d.get(3, 0),
                     d.get(2, 0), d.get(1, 0), f"{avg:.1f}"])
    col_w = [16 * mm] + [17 * mm] * 5 + [18 * mm]
    t = Table(rows, colWidths=col_w, hAlign="LEFT")
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY_C),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TEXTCOLOR", (0, 1), (-1, -1), TEXT_C),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E6EA")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("FONTNAME", (-1, 1), (-1, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (-1, 1), (-1, -1), NAVY_C),
    ]
    for i in range(1, len(rows)):
        if i % 2 == 0:
            style.append(("BACKGROUND", (0, i), (-1, i), LIGHT_BG))
    t.setStyle(TableStyle(style))
    return t


def _comment_block(class_label, comments):
    header = Table([[Paragraph(class_label, styles["ClassCardHeader"])]], colWidths=[164 * mm])
    header.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY_C),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    body_rows = [[Paragraph(f"&bull;&nbsp;&nbsp;{c}", styles["Comment"])] for c in comments] or \
                [[Paragraph("<i>No written comments submitted.</i>", styles["Comment"])]]
    body = Table(body_rows, colWidths=[164 * mm])
    body.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#E2E6EA")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    return KeepTogether([header, body, Spacer(1, 8)])


def build_report(data, out_path):
    """
    data shape (from processor.py):
    {
      "teacher": "Ms Karthika",
      "subject_line": "BIOLOGY",                # or comma-joined subjects
      "classes": [{"class": "VI", "section": "C", "subject": "BIOLOGY", "responses": 2}, ...],
      "distribution": [ {5:0,4:0,3:2,2:1,1:0}, ... ]   # one dict per question, in Q1..Q10 order
      "comments": { "VI-C : BIOLOGY": ["raji 11.31"], ... },
      "overall_average": 2.67,
      "total_responses": 3,
    }
    """
    question_labels = data.get("question_labels") or [f"Q{i+1}" for i in range(len(data["distribution"]))]

    # --- charts ---
    tmp_dir = os.path.dirname(out_path) or "."
    os.makedirs(tmp_dir, exist_ok=True)
    avg_chart_path = os.path.join(tmp_dir, "_avg_chart.png")
    dist_chart_path = os.path.join(tmp_dir, "_dist_chart.png")

    question_averages = []
    for d in data["distribution"]:
        total = sum(d.values()) or 1
        question_averages.append(sum(r * d.get(r, 0) for r in range(1, 6)) / total)

    average_rating_chart(question_averages, avg_chart_path, question_labels)
    distribution_chart(data["distribution"], dist_chart_path, question_labels)

    # --- doc / page templates ---
    frame = Frame(MARGIN, MARGIN, PAGE_W - 2 * MARGIN, PAGE_H - MARGIN - 30 * mm, id="main")

    def on_page(canv, doc):
        _draw_chrome(canv, doc, data["teacher"], data.get("subject_line", ""))

    doc = BaseDocTemplate(out_path, pagesize=A4,
                           leftMargin=MARGIN, rightMargin=MARGIN,
                           topMargin=MARGIN, bottomMargin=MARGIN)
    doc.addPageTemplates([PageTemplate(id="report", frames=[frame], onPage=on_page)])

    story = []

    # ---- Page 1: identity + stats + classes + overall ratings ----
    story.append(Spacer(1, 4))
    story.append(Paragraph(data["teacher"], styles["TeacherName"]))
    story.append(Paragraph(data.get("subject_line", ""), styles["Subtitle"]))
    story.append(Spacer(1, 12))

    stat_row = Table([[
        _stat_card(str(data["total_responses"]), "Total Responses"),
        _stat_card(str(len(data["classes"])), "Classes Evaluated", accent=GOLD_C),
        _stat_card(f'{data["overall_average"]:.1f} / 5', "Overall Average"),
    ]], colWidths=[54 * mm, 54 * mm, 54 * mm])
    stat_row.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER")]))
    story.append(stat_row)

    story.append(Paragraph("Classes Evaluated", styles["SectionHeading"]))
    story.append(_classes_table(data["classes"]))

    story.append(Paragraph("Overall Question Ratings", styles["SectionHeading"]))
    story.append(Paragraph(
        "Average score per question across all classes and responses (scale 1&ndash;5).",
        styles["Subtitle"]))
    story.append(Spacer(1, 4))
    story.append(Image(avg_chart_path, width=164 * mm,
                        height=164 * mm * (0.42 * len(question_labels) + 1.1) / 7.6))

    # ---- Page 2: distribution table + chart ----
    story.append(PageBreak())
    story.append(Paragraph("Question-wise Rating Distribution", styles["SectionHeading"]))
    story.append(_distribution_table(data["distribution"], question_labels))
    story.append(Spacer(1, 10))
    story.append(Image(dist_chart_path, width=164 * mm,
                        height=164 * mm * (0.42 * len(question_labels) + 1.3) / 7.6 * 0.9))

    # ---- Page 3: comments ----
    story.append(PageBreak())
    story.append(Paragraph("Student Comments", styles["SectionHeading"]))
    if data["comments"]:
        for class_label, comments in data["comments"].items():
            story.append(_comment_block(class_label, comments))
    else:
        story.append(Paragraph("<i>No written comments submitted for this teacher.</i>",
                                styles["Comment"]))

    doc.build(story)

    for p in (avg_chart_path, dist_chart_path):
        if os.path.exists(p):
            os.remove(p)

    return out_path


def _normalize(teacher_data):
    """
    Matches the exact shape returned by processor.py's build_teacher_data():

        {
          "teacher": str,
          "responses": int,                       # total row count
          "rows": [...],                           # raw rows, unused here
          "classes": { (class, section, subject): [row, row, ...], ... },
          "distribution": [ {"question": "Q1", "ratings": {5:n,4:n,3:n,2:n,1:n}}, ... ],
          "comments": { (class, section, subject): [comment, comment, ...], ... },
        }
    """
    d = dict(teacher_data)  # don't mutate caller's dict
    d.setdefault("teacher", "Unknown Teacher")

    # --- classes: tuple-keyed dict of raw rows -> list of summary dicts ---
    raw_classes = d.get("classes") or {}
    class_list = []
    for (cls, section, subject), rows in raw_classes.items():
        class_list.append({
            "class": cls, "section": section, "subject": subject,
            "responses": len(rows),
        })
    class_list.sort(key=lambda c: (str(c["class"]), str(c["section"]), str(c["subject"])))
    d["classes"] = class_list

    # --- distribution: [{"question": "Q1", "ratings": {...}}, ...] -> labels + plain dicts ---
    raw_distribution = d.get("distribution") or []
    d["question_labels"] = [item["question"] for item in raw_distribution]
    d["distribution"] = [item["ratings"] for item in raw_distribution]

    # --- comments: tuple-keyed dict -> "Class-Section : Subject" keyed dict ---
    raw_comments = d.get("comments") or {}
    comments_out = {}
    for (cls, section, subject), comment_list in raw_comments.items():
        comments_out[f"{cls}-{section} : {subject}"] = comment_list
    d["comments"] = comments_out

    # --- totals ---
    d["total_responses"] = d.get("responses", sum(c["responses"] for c in class_list))

    subjects = []
    for c in class_list:
        if c["subject"] not in subjects:
            subjects.append(c["subject"])
    d["subject_line"] = ", ".join(subjects) if subjects else ""

    per_q_avg = []
    for q in d["distribution"]:
        total = sum(q.values()) or 1
        per_q_avg.append(sum(r * q.get(r, 0) for r in range(1, 6)) / total)
    d["overall_average"] = sum(per_q_avg) / len(per_q_avg) if per_q_avg else 0.0

    return d


def create_teacher_pdf(teacher_data, out_dir="exports/PDFs"):
    """
    Entry point expected by main.py:
        from pdf_report import create_teacher_pdf
        create_teacher_pdf(teacher_data)
    """
    data = _normalize(teacher_data)

    os.makedirs(out_dir, exist_ok=True)
    safe_name = "".join(c for c in data["teacher"] if c.isalnum() or c in (" ", "_", "-")).strip()
    out_path = os.path.join(out_dir, f"{safe_name}_Report.pdf")

    return build_report(data, out_path)


if __name__ == "__main__":
    # Demo data reconstructed from Ms Karthika's current sample report
    sample_distribution = [{5: 0, 4: 0, 3: 2, 2: 1, 1: 0} for _ in range(10)]
    demo_data = {
        "teacher": "Ms Karthika",
        "subject_line": "Biology",
        "classes": [
            {"class": "VI", "section": "C", "subject": "BIOLOGY", "responses": 2},
            {"class": "VII", "section": "C", "subject": "BIOLOGY", "responses": 1},
        ],
        "distribution": sample_distribution,
        "comments": {
            "VI-C : Biology": ["Very friendly teacher and explains topics clearly."],
        },
        "overall_average": sum(
            sum(r * d.get(r, 0) for r in range(1, 6)) / sum(d.values()) for d in sample_distribution
        ) / len(sample_distribution),
        "total_responses": 3,
    }
    out = build_report(demo_data, "exports/PDFs/Ms_Karthika_Report_v2.pdf")
    print("Wrote", out)
