function buildPagination({ total, page, limit, baseUrl, existingQuery = {} }) {
    const totalPages = Math.ceil(total / limit);
    const params = new URLSearchParams(existingQuery);
    
    // Helper to generate URL for a specific page
    const getPageUrl = (pageNum) => {
        params.set('page', pageNum);
        return `${baseUrl}?${params.toString()}`;
    };

    return {
        currentPage: page,
        totalPages,
        totalItems: total,
        limit,
        hasPrev: page > 1,
        hasNext: page < totalPages,
        prevUrl: page > 1 ? getPageUrl(page - 1) : null,
        nextUrl: page < totalPages ? getPageUrl(page + 1) : null,
        pages: Array.from({ length: totalPages }, (_, i) => ({
            number: i + 1,
            url: getPageUrl(i + 1),
            isCurrent: i + 1 === page
        }))
    };
}

module.exports = { buildPagination };
