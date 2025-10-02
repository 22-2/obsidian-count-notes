
export function invariant(condition: any, message: string): asserts condition {
	if (!condition) {
		throw new Error(`Invariant failed: ${message}`);
	}
}

export function throwExpression(error: Error): never {
	throw error;
}
