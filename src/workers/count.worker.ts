// Worker: receive messages of shape { id: string, content: string }
// or { batch: [{id, content}, ...] } and respond with { id, count }

function stripFrontmatter(content: string): string {
    if (content.startsWith("---")) {
        const idx = content.indexOf("\n---", 3);
        if (idx !== -1) {
            return content.slice(idx + 4);
        }
    }
    return content;
}

function countVisibleChars(content: string): number {
    const body = stripFrontmatter(content);
    // remove whitespace and full-width spaces
    const cleaned = body.replace(/[\s\u3000]+/g, "");
    return cleaned.length;
}

self.onmessage = function (e) {
    const data = e.data;
    if (!data) return;

    if (data.batch && Array.isArray(data.batch)) {
        const results = data.batch.map((item: any) => ({ id: item.id, count: countVisibleChars(item.content) }));
        // send back array
        self.postMessage({ results });
        return;
    }

    if (data.id && typeof data.content === "string") {
        const count = countVisibleChars(data.content);
        self.postMessage({ id: data.id, count });
    }
};

export {};
