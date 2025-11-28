from typing import Generic, TypeVar, List
from pydantic import BaseModel
from pydantic.generics import GenericModel

T = TypeVar("T")

class PaginatedResponse(GenericModel, Generic[T]):
    total: int
    items: List[T]
    page: int
    size: int
