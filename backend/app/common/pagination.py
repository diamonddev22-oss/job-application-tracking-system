from sqlalchemy.orm import Query


def paginate(query: Query, page: int, size: int) -> tuple[list, int, int, bool]:
    """Mirrors Spring Data's Page semantics: totalPages = ceil(total / size) (0 when there are no
    rows), and `last` is true once the requested page reaches or passes the final page."""
    total_elements = query.count()
    items = query.offset(page * size).limit(size).all()

    total_pages = (total_elements + size - 1) // size if size > 0 else 0
    last = (page + 1) >= total_pages if total_pages > 0 else True

    return items, total_elements, total_pages, last
