import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(url, key)


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