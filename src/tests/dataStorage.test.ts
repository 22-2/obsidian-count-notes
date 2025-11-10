import { DataStorage } from "../data";

const mockIdb = {
	loadData: jest.fn(),
	saveData: jest.fn(),
};

jest.mock("../idb", () => ({
	Idb: jest.fn().mockImplementation(() => mockIdb),
}));

class MockPlugin {
	settings = {
		logLevel: "debug" as const,
		trackingTag: "novel",
	};
	loadData = jest.fn();
	saveData = jest.fn();
}

describe("DataStorage - Hourly Stats", () => {
	let dataStorage: DataStorage;
	let mockPlugin: MockPlugin;

	beforeEach(async () => {
		mockPlugin = new MockPlugin();
		mockPlugin.loadData.mockResolvedValue(null);
		mockIdb.loadData.mockResolvedValue(null);
		dataStorage = new DataStorage(mockPlugin as any);
		await dataStorage.loadData();
	});

	describe("updateHourlyStats", () => {
		test("should add hourly stats for a new time slot", () => {
			const date = "2025-10-02";
			const characterDiff = 500;

			dataStorage.updateHourlyStats(date, characterDiff);

			const data = dataStorage.getData();
			expect(data?.hourlyStats).toBeDefined();

			// 現在時刻（モックでは10時）のスロットに記録される
			const currentHour = new Date().getHours();
			const timeSlotKey = `${date}-${currentHour}`;
			expect(data?.hourlyStats?.[timeSlotKey]).toBe(500);
		});

		test("should accumulate stats for the same time slot", () => {
			const date = "2025-10-02";

			dataStorage.updateHourlyStats(date, 300);
			dataStorage.updateHourlyStats(date, 200);
			dataStorage.updateHourlyStats(date, 100);

			const data = dataStorage.getData();
			const currentHour = new Date().getHours();
			const timeSlotKey = `${date}-${currentHour}`;

			expect(data?.hourlyStats?.[timeSlotKey]).toBe(600);
		});

		test("should handle negative character differences", () => {
			const date = "2025-10-02";

			dataStorage.updateHourlyStats(date, 500);
			dataStorage.updateHourlyStats(date, -200);

			const data = dataStorage.getData();
			const currentHour = new Date().getHours();
			const timeSlotKey = `${date}-${currentHour}`;

			expect(data?.hourlyStats?.[timeSlotKey]).toBe(300);
		});

		test("should initialize hourlyStats if it doesn't exist", () => {
			const data = dataStorage.getData();
			expect(data?.hourlyStats).toBeDefined();

			dataStorage.updateHourlyStats("2025-10-02", 100);

			const updatedData = dataStorage.getData();
			expect(updatedData?.hourlyStats).toBeDefined();
			expect(
				Object.keys(updatedData?.hourlyStats || {}).length
			).toBeGreaterThan(0);
		});

		test("should throw error for invalid date format", () => {
			expect(() => {
				dataStorage.updateHourlyStats("2025/10/02", 100);
			}).toThrow("Invalid date format");

			expect(() => {
				dataStorage.updateHourlyStats("10-02-2025", 100);
			}).toThrow("Invalid date format");

			expect(() => {
				dataStorage.updateHourlyStats("2025-10-2", 100);
			}).toThrow("Invalid date format");
		});

		test("should throw error for non-integer character diff", () => {
			expect(() => {
				dataStorage.updateHourlyStats("2025-10-02", 100.5);
			}).toThrow("Character diff must be an integer");

			expect(() => {
				dataStorage.updateHourlyStats("2025-10-02", NaN);
			}).toThrow("Character diff must be an integer");
		});

		test("should handle zero character difference", () => {
			const date = "2025-10-02";

			dataStorage.updateHourlyStats(date, 0);

			const data = dataStorage.getData();
			const currentHour = new Date().getHours();
			const timeSlotKey = `${date}-${currentHour}`;

			expect(data?.hourlyStats?.[timeSlotKey]).toBe(0);
		});
	});

	describe("updateDailyStats and updateHourlyStats together", () => {
		test("should update both daily and hourly stats independently", () => {
			const date = "2025-10-02";
			const characterDiff = 500;

			dataStorage.updateDailyStats(date, characterDiff);
			dataStorage.updateHourlyStats(date, characterDiff);

			const data = dataStorage.getData();

			// 日次統計
			expect(data?.dailyStats[date]).toBe(500);

			// 時間別統計
			const currentHour = new Date().getHours();
			const timeSlotKey = `${date}-${currentHour}`;
			expect(data?.hourlyStats?.[timeSlotKey]).toBe(500);
		});

		test("should allow different values for daily and hourly stats", () => {
			const date = "2025-10-02";

			dataStorage.updateDailyStats(date, 1000);
			dataStorage.updateHourlyStats(date, 300);

			const data = dataStorage.getData();

			expect(data?.dailyStats[date]).toBe(1000);

			const currentHour = new Date().getHours();
			const timeSlotKey = `${date}-${currentHour}`;
			expect(data?.hourlyStats?.[timeSlotKey]).toBe(300);
		});
	});

	describe("multiple time slots", () => {
		test("should track different hours separately", () => {
			// 注意: このテストは実際の時刻に依存するため、
			// 実際の実装では時刻をモック可能にする必要がある
			const date = "2025-10-02";

			dataStorage.updateHourlyStats(date, 100);

			const data = dataStorage.getData();
			const currentHour = new Date().getHours();
			const timeSlotKey = `${date}-${currentHour}`;

			expect(data?.hourlyStats?.[timeSlotKey]).toBe(100);

			// 他の時間帯のデータは存在しない
			const otherHour = (currentHour + 1) % 24;
			const otherTimeSlotKey = `${date}-${otherHour}`;
			expect(data?.hourlyStats?.[otherTimeSlotKey]).toBeUndefined();
		});

		test("should handle multiple dates", () => {
			dataStorage.updateHourlyStats("2025-10-01", 100);
			dataStorage.updateHourlyStats("2025-10-02", 200);
			dataStorage.updateHourlyStats("2025-10-03", 300);

			const data = dataStorage.getData();
			const currentHour = new Date().getHours();

			expect(data?.hourlyStats?.[`2025-10-01-${currentHour}`]).toBe(100);
			expect(data?.hourlyStats?.[`2025-10-02-${currentHour}`]).toBe(200);
			expect(data?.hourlyStats?.[`2025-10-03-${currentHour}`]).toBe(300);
		});
	});

	describe("data persistence", () => {
		test("should maintain hourlyStats structure after multiple updates", () => {
			const date = "2025-10-02";

			for (let i = 0; i < 10; i++) {
				dataStorage.updateHourlyStats(date, 50);
			}

			const data = dataStorage.getData();
			expect(data?.hourlyStats).toBeDefined();
			expect(typeof data?.hourlyStats).toBe("object");

			const currentHour = new Date().getHours();
			const timeSlotKey = `${date}-${currentHour}`;
			expect(data?.hourlyStats?.[timeSlotKey]).toBe(500);
		});

		test("should not affect other data when updating hourly stats", () => {
			const date = "2025-10-02";

			// 他のデータを設定
			dataStorage.updateDailyStats(date, 1000);
			dataStorage.updateLastTotalCharacterCount(5000);
			dataStorage.updateViewState("month");

			// 時間別統計を更新
			dataStorage.updateHourlyStats(date, 300);

			const data = dataStorage.getData();

			// 他のデータが保持されていることを確認
			expect(data?.dailyStats[date]).toBe(1000);
			expect(data?.lastTotalCharacterCount).toBe(5000);
			expect(data?.lastViewState?.period).toBe("month");

			// 時間別統計も正しく設定されている
			const currentHour = new Date().getHours();
			const timeSlotKey = `${date}-${currentHour}`;
			expect(data?.hourlyStats?.[timeSlotKey]).toBe(300);
		});
	});

	describe("backward compatibility", () => {
		test("should work with data that doesn't have hourlyStats", async () => {
			mockPlugin.loadData.mockResolvedValue({
				settings: mockPlugin.settings,
				lastViewState: { period: "month" },
			});
			mockIdb.loadData.mockResolvedValue({
				lastTotalCharacterCount: 1000,
				dailyStats: { "2025-10-01": 500 },
				hourlyStats: undefined,
			});

			const oldDataStorage = new DataStorage(mockPlugin as any);
			await oldDataStorage.loadData();

			// hourlyStatsを更新しても問題なく動作する
			expect(() => {
				oldDataStorage.updateHourlyStats("2025-10-02", 100);
			}).not.toThrow();

			const data = oldDataStorage.getData();
			expect(data?.hourlyStats).toBeDefined();
		});
	});
});
