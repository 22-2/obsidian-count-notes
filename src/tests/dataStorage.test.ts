import { DataStorage } from "../data";

// モックプラグイン
class MockPlugin {
	settings = {
		logLevel: "debug" as const,
		trackingTag: "novel",
	};

	async loadData() {
		return null;
	}

	async saveData(data: any) {
		// モック実装
	}
}

describe("DataStorage", () => {
	let dataStorage: DataStorage;
	let mockPlugin: MockPlugin;

	beforeEach(async () => {
		mockPlugin = new MockPlugin();
		dataStorage = new DataStorage(mockPlugin as any);
		await dataStorage.loadData();
	});

	describe("updateViewState", () => {
		test("should update the view state", () => {
			dataStorage.updateViewState("week");
			const data = dataStorage.getData();
			expect(data?.lastViewState?.period).toBe("week");
		});

		test("should throw error for invalid period", () => {
			expect(() => {
				dataStorage.updateViewState("invalid" as any);
			}).toThrow("Invalid period: invalid");
		});
	});
});
