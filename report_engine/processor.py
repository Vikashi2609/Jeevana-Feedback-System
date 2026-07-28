from collections import defaultdict


def build_teacher_data(teacher, rows):

    classes = defaultdict(list)

    for row in rows:

        key = (
            row["class"],
            row["section"],
            row["subject"]
        )

        classes[key].append(row)

    overall_distribution = []

    for i in range(1, 11):

        counts = {
            5: 0,
            4: 0,
            3: 0,
            2: 0,
            1: 0
        }

        for row in rows:
            counts[row[f"q{i}"]] += 1

        overall_distribution.append({
            "question": f"Q{i}",
            "ratings": counts
        })

    comments = defaultdict(list)

    for row in rows:

        if row["comment"]:

            key = (
                row["class"],
                row["section"],
                row["subject"]
            )

            comments[key].append(row["comment"])

    return {

        "teacher": teacher,

        "responses": len(rows),

        "rows": rows,

        "classes": dict(classes),

        "distribution": overall_distribution,

        "comments": dict(comments),

    }