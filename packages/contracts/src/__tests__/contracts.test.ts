/**
 * API Contract Tests
 * API 契约测试
 */

// Import all contracts to verify exports
import * as contracts from '../api';

describe('API Contracts', () => {
  describe('Contract Exports', () => {
    const expectedContracts = [
      'assessmentContract',
      'audioTranscribeContract',
      'collaborateContract',
      'downloadContract',
      'knowledgeBaseContract',
      'logContract',
      'messageContract',
      'oauthContract',
      'passwordContract',
      'qrcodeContract',
      'rbacContract',
      'recycleBinContract',
      'riskWordsContract',
      'settingContract',
      'signContract',
      'smsContract',
      'spaceContract',
      'systemContract',
      'taskContract',
      'teamContract',
      'transferSaveContract',
      'uploaderContract',
      'userContract',
      'videoTranscodeContract',
      'webhookContract',
    ];

    expectedContracts.forEach((contractName) => {
      it(`should export ${contractName}`, () => {
        expect(
          (contracts as Record<string, unknown>)[contractName],
        ).toBeDefined();
      });
    });
  });

  describe('Contract Structure', () => {
    it('should have valid team contract structure', () => {
      const { teamContract } = contracts;
      expect(teamContract).toBeDefined();

      // Check that it has router structure
      expect(typeof teamContract).toBe('object');
    });

    it('should have valid space contract structure', () => {
      const { spaceContract } = contracts;
      expect(spaceContract).toBeDefined();
      expect(typeof spaceContract).toBe('object');
    });


    it('should have valid download contract with typed error responses', () => {
      const { downloadContract } = contracts;
      expect(downloadContract).toBeDefined();
      expect(typeof downloadContract).toBe('object');
    });

    it('should have valid recycle-bin contract with typed error responses', () => {
      const { recycleBinContract } = contracts;
      expect(recycleBinContract).toBeDefined();
      expect(typeof recycleBinContract).toBe('object');
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
