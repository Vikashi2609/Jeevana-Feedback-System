import os
import mimetypes
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(url, key)

REPORTS_BUCKET = "teacher-reports"


def get_teacher_responses(teacher):
    response = (
        supabase
        .table("responses")
        .select("*")
        .eq("teacher", teacher)
        .execute()
    )

    return response.data


def get_all_teachers():
    response = (
        supabase
        .table("responses")
        .select("teacher")
        .execute()
    )

    teachers = sorted(set(row["teacher"] for row in response.data))
    return teachers


def upload_teacher_report(local_path, teacher, kind):
    """
    Uploads a generated report file to Supabase Storage.

    local_path : path to the file on disk (e.g. "exports/PDFs/Ms Karthika_Report.pdf")
    teacher    : teacher name, used as a folder so the admin page can group by teacher
    kind       : "pdf" or "xlsx" — used only for the content-type guess and log message

    Storage path used: {bucket}/{teacher}/{filename}
    Existing files at the same path are overwritten (upsert), so re-running the
    pipeline updates the report rather than creating duplicates.

    Returns the storage path (e.g. "Ms Karthika/Ms Karthika_Report.pdf") on success.
    """
    filename = os.path.basename(local_path)
    storage_path = f"{teacher}/{filename}"

    content_type, _ = mimetypes.guess_type(local_path)
    if not content_type:
        content_type = "application/pdf" if kind == "pdf" else \
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    with open(local_path, "rb") as f:
        file_bytes = f.read()

    supabase.storage.from_(REPORTS_BUCKET).upload(
        path=storage_path,
        file=file_bytes,
        file_options={"content-type": content_type, "upsert": "true"},
    )

    print(f"  Uploaded {kind} -> {REPORTS_BUCKET}/{storage_path}")
    return storage_path