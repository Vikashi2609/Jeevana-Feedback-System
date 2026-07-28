from supabase_connection import (
    get_teacher_responses,
    get_all_teachers,
    upload_teacher_report,
)

from processor import build_teacher_data
from pdf_report import create_teacher_pdf
from excel_report import create_teacher_workbook

teachers = get_all_teachers()

print("Teachers found:", teachers)

for teacher in teachers:

    print("Generating report for:", teacher)

    rows = get_teacher_responses(teacher)

    print("Responses:", len(rows))

    if not rows:
        continue

    teacher_data = build_teacher_data(
        teacher,
        rows
    )

    pdf_path = create_teacher_pdf(teacher_data)
    xlsx_path = create_teacher_workbook(teacher_data)

    upload_teacher_report(pdf_path, teacher, kind="pdf")
    upload_teacher_report(xlsx_path, teacher, kind="xlsx")