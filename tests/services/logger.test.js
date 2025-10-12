import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '../../src/services/logger.js';

describe('Logger', () => {
    let logger;
    let consoleSpy;

    beforeEach(() => {
        // Spy on console methods
        consoleSpy = {
            error: vi.spyOn(console, 'error').mockImplementation(() => {}),
            warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
            info: vi.spyOn(console, 'info').mockImplementation(() => {}),
            debug: vi.spyOn(console, 'debug').mockImplementation(() => {})
        };
        
        // Mock Date.prototype.toISOString to have predictable timestamps
        vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2025-10-12T14:00:00.000Z');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with default info level', () => {
            logger = new Logger();
            expect(logger.level).toBe('info');
            expect(logger.levels).toEqual({ error: 0, warn: 1, info: 2, debug: 3 });
        });

        it('should initialize with custom level', () => {
            logger = new Logger('debug');
            expect(logger.level).toBe('debug');
        });
    });

    describe('log levels', () => {
        it('should respect error level (only errors)', () => {
            logger = new Logger('error');

            logger.error('Error message');
            logger.warn('Warn message');
            logger.info('Info message');
            logger.debug('Debug message');

            expect(consoleSpy.error).toHaveBeenCalledWith(
                '[2025-10-12T14:00:00.000Z] ERROR: Error message'
            );
            expect(consoleSpy.warn).not.toHaveBeenCalled();
            expect(consoleSpy.info).not.toHaveBeenCalled();
            expect(consoleSpy.debug).not.toHaveBeenCalled();
        });

        it('should respect warn level (errors and warnings)', () => {
            logger = new Logger('warn');

            logger.error('Error message');
            logger.warn('Warn message');
            logger.info('Info message');
            logger.debug('Debug message');

            expect(consoleSpy.error).toHaveBeenCalledWith(
                '[2025-10-12T14:00:00.000Z] ERROR: Error message'
            );
            expect(consoleSpy.warn).toHaveBeenCalledWith(
                '[2025-10-12T14:00:00.000Z] WARN: Warn message'
            );
            expect(consoleSpy.info).not.toHaveBeenCalled();
            expect(consoleSpy.debug).not.toHaveBeenCalled();
        });

        it('should respect info level (errors, warnings, and info)', () => {
            logger = new Logger('info');

            logger.error('Error message');
            logger.warn('Warn message');
            logger.info('Info message');
            logger.debug('Debug message');

            expect(consoleSpy.error).toHaveBeenCalledWith(
                '[2025-10-12T14:00:00.000Z] ERROR: Error message'
            );
            expect(consoleSpy.warn).toHaveBeenCalledWith(
                '[2025-10-12T14:00:00.000Z] WARN: Warn message'
            );
            expect(consoleSpy.info).toHaveBeenCalledWith(
                '[2025-10-12T14:00:00.000Z] INFO: Info message'
            );
            expect(consoleSpy.debug).not.toHaveBeenCalled();
        });

        it('should respect debug level (all messages)', () => {
            logger = new Logger('debug');

            logger.error('Error message');
            logger.warn('Warn message');
            logger.info('Info message');
            logger.debug('Debug message');

            expect(consoleSpy.error).toHaveBeenCalledWith(
                '[2025-10-12T14:00:00.000Z] ERROR: Error message'
            );
            expect(consoleSpy.warn).toHaveBeenCalledWith(
                '[2025-10-12T14:00:00.000Z] WARN: Warn message'
            );
            expect(consoleSpy.info).toHaveBeenCalledWith(
                '[2025-10-12T14:00:00.000Z] INFO: Info message'
            );
            expect(consoleSpy.debug).toHaveBeenCalledWith(
                '[2025-10-12T14:00:00.000Z] DEBUG: Debug message'
            );
        });
    });

    describe('log method', () => {
        beforeEach(() => {
            logger = new Logger('debug');
        });

        it('should format messages with timestamp and level', () => {
            logger.log('info', 'Test message');

            expect(consoleSpy.info).toHaveBeenCalledWith(
                '[2025-10-12T14:00:00.000Z] INFO: Test message'
            );
        });

        it('should pass additional arguments', () => {
            const obj = { key: 'value' };
            logger.log('info', 'Test message', obj, 'extra arg');

            expect(consoleSpy.info).toHaveBeenCalledWith(
                '[2025-10-12T14:00:00.000Z] INFO: Test message',
                obj,
                'extra arg'
            );
        });

        it('should not log if level is below threshold', () => {
            logger.level = 'error';
            logger.log('info', 'Should not appear');

            expect(consoleSpy.info).not.toHaveBeenCalled();
        });
    });

    describe('convenience methods', () => {
        beforeEach(() => {
            logger = new Logger('debug');
        });

        it('should call error method correctly', () => {
            logger.error('Error occurred', { code: 500 });

            expect(consoleSpy.error).toHaveBeenCalledWith(
                '[2025-10-12T14:00:00.000Z] ERROR: Error occurred',
                { code: 500 }
            );
        });

        it('should call warn method correctly', () => {
            logger.warn('Warning issued', 'details');

            expect(consoleSpy.warn).toHaveBeenCalledWith(
                '[2025-10-12T14:00:00.000Z] WARN: Warning issued',
                'details'
            );
        });

        it('should call info method correctly', () => {
            logger.info('Information logged');

            expect(consoleSpy.info).toHaveBeenCalledWith(
                '[2025-10-12T14:00:00.000Z] INFO: Information logged'
            );
        });

        it('should call debug method correctly', () => {
            logger.debug('Debug info', { trace: true });

            expect(consoleSpy.debug).toHaveBeenCalledWith(
                '[2025-10-12T14:00:00.000Z] DEBUG: Debug info',
                { trace: true }
            );
        });
    });

    describe('edge cases', () => {
        it('should handle invalid log levels gracefully', () => {
            logger = new Logger('invalid');
            
            // With invalid level, comparison will be undefined <= undefined, which is false
            logger.info('Test message');
            
            expect(consoleSpy.info).not.toHaveBeenCalled();
        });

        it('should handle empty messages', () => {
            logger = new Logger('info');
            logger.info('');

            expect(consoleSpy.info).toHaveBeenCalledWith(
                '[2025-10-12T14:00:00.000Z] INFO: '
            );
        });

        it('should handle undefined and null arguments', () => {
            logger = new Logger('info');
            logger.info('Message', undefined, null);

            expect(consoleSpy.info).toHaveBeenCalledWith(
                '[2025-10-12T14:00:00.000Z] INFO: Message',
                undefined,
                null
            );
        });
    });
});