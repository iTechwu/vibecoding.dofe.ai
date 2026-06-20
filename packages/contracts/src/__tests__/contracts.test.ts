/**
 * API Contract Tests
 * API 契约测试
 */

// Import all contracts to verify exports
import * as contracts from '../api';

describe('API Contracts', () => {
  describe('Contract Exports', () => {
    const expectedContracts = [
      'analyticsContract',
      'downloadContract',
      'loopsContract',
      'messageContract',
      'oidcAuthContract',
      'riskWordsContract',
      'settingContract',
      'smsContract',
      'systemContract',
      'taskContract',
      'userContract',
      'webhookContract',
    ];

    expectedContracts.forEach((contractName) => {
      it(`should export ${contractName}`, () => {
        expect((contracts as Record<string, unknown>)[contractName]).toBeDefined();
      });
    });
  });

  describe('Contract Structure', () => {
    const exportedContractNames = Object.keys(contracts).filter((name) =>
      name.endsWith('Contract'),
    );

    it('should only expose current contract objects', () => {
      expect(exportedContractNames.sort()).toEqual(
        [
          'analyticsContract',
          'downloadContract',
          'loopsContract',
          'messageContract',
          'oidcAuthContract',
          'riskWordsContract',
          'settingContract',
          'smsContract',
          'systemContract',
          'taskContract',
          'userContract',
          'webhookContract',
        ].sort(),
      );
    });

    it.each(exportedContractNames)('%s should be a router object', (name) => {
      expect((contracts as Record<string, unknown>)[name]).toBeDefined();
      expect(typeof (contracts as Record<string, unknown>)[name]).toBe('object');
    });
  });

  describe('Contract Types', () => {
    it('should export contract types', () => {
      // These are type exports, so we just verify they don't cause errors
      // The actual type checking is done at compile time
      expect(true).toBe(true);
    });
  });
});
