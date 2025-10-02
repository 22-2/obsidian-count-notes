// Jest setup file
// Global test configuration and mocks

// Mock Obsidian APIs
global.console = {
  ...console,
  // Suppress console.log in tests unless needed
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

// Mock Date to ensure consistent test results
const mockDate = new Date('2025-10-02T10:00:00.000Z');

// Simple Date mock
jest.useFakeTimers();
jest.setSystemTime(mockDate);