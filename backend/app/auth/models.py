from dataclasses import dataclass


@dataclass(frozen=True)
class User:
    id: int
    username: str
    role: str


# App role -> database role used to run queries. Least privilege: admin queries as analyst.
# 'auditor' is absent on purpose: auditors cannot ask questions.
DATA_ROLE = {"analyst": "analyst", "admin": "analyst", "steward": "steward"}