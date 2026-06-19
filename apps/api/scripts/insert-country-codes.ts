/**
 * 脚本：将 codeOfCountries 数据插入到数据库
 *
 * 使用方法：
 * npx ts-node scripts/insert-country-codes.ts
 */

import { PrismaClient } from '@prisma/client';
import * as process from 'process';

const prisma = new PrismaClient();

const codeOfCountries = {
  us: [
    'AI',
    'AG',
    'AR',
    'AW',
    'BS',
    'BB',
    'BZ',
    'BM',
    'BO',
    'BR',
    'VG',
    'CA',
    'KY',
    'CL',
    'CO',
    'CR',
    'CU',
    'CW',
    'DM',
    'DO',
    'EC',
    'SV',
    'FK',
    'GF',
    'GL',
    'GD',
    'GP',
    'GT',
    'GY',
    'HT',
    'HN',
    'JM',
    'MQ',
    'MX',
    'MS',
    'NI',
    'PA',
    'PY',
    'PE',
    'PR',
    'BL',
    'KN',
    'LC',
    'MF',
    'VC',
    'SX',
    'SR',
    'TT',
    'TC',
    'US',
    'UY',
    'VE',
  ],
  eu: [
    'AL',
    'AD',
    'AM',
    'AT',
    'BY',
    'BE',
    'BA',
    'BG',
    'HR',
    'CY',
    'CZ',
    'DK',
    'EE',
    'FI',
    'FR',
    'GE',
    'DE',
    'GR',
    'HU',
    'IS',
    'IE',
    'IT',
    'KZ',
    'XK',
    'LV',
    'LI',
    'LT',
    'LU',
    'MT',
    'MD',
    'MC',
    'ME',
    'NL',
    'MK',
    'NO',
    'PL',
    'PT',
    'RO',
    'RU',
    'SM',
    'RS',
    'SK',
    'SI',
    'ES',
    'SE',
    'CH',
    'TR',
    'UA',
    'GB',
    'VA',
    'DZ',
    'AO',
    'BJ',
    'BW',
    'BF',
    'BI',
    'CV',
    'CM',
    'CF',
    'TD',
    'KM',
    'CG',
    'CD',
    'DJ',
    'EG',
    'GQ',
    'ER',
    'SZ',
    'ET',
    'GA',
    'GM',
    'GH',
    'GN',
    'GW',
    'CI',
    'KE',
    'LS',
    'LR',
    'LY',
    'MG',
    'MW',
    'ML',
    'MR',
    'MU',
    'YT',
    'MA',
    'MZ',
    'NA',
    'NE',
    'NG',
    'RW',
    'RE',
    'SH',
    'ST',
    'SN',
    'SC',
    'SL',
    'SO',
    'ZA',
    'SS',
    'SD',
    'TZ',
    'TG',
    'TN',
    'UG',
    'EH',
    'ZM',
    'ZW',
  ],
  ap: [
    'AF',
    'AZ',
    'BH',
    'BD',
    'BT',
    'BN',
    'KH',
    'CY',
    'TL',
    'GE',
    'IN',
    'ID',
    'IR',
    'IQ',
    'IL',
    'JP',
    'JO',
    'KZ',
    'KW',
    'KG',
    'HK',
    'LA',
    'LB',
    'MO',
    'MY',
    'MV',
    'MN',
    'MM',
    'NP',
    'KP',
    'OM',
    'PK',
    'PS',
    'PH',
    'QA',
    'SA',
    'SG',
    'KR',
    'LK',
    'SY',
    'TW',
    'TJ',
    'TH',
    'TR',
    'TM',
    'AE',
    'UZ',
    'VN',
    'YE',
    'AU',
    'FJ',
    'KI',
    'MH',
    'FM',
    'NR',
    'NZ',
    'PW',
    'PG',
    'WS',
    'SB',
    'TO',
    'TV',
    'VU',
  ],
  cn: ['CN'],
};

async function insertCountryCodes() {
  try {
    console.log('开始插入国家代码数据...');

    // 先清空现有数据
    console.log('清空现有数据...');
    const deleteResult = await prisma.countryCode.deleteMany({});
    console.log(`已删除 ${deleteResult.count} 条记录`);

    // 准备批量插入数据
    const data: { continent: string; code: string }[] = [];
    for (const [continent, codes] of Object.entries(codeOfCountries)) {
      for (const code of codes) {
        data.push({
          continent,
          code,
        });
      }
    }

    console.log(`准备插入 ${data.length} 条记录...`);

    // 批量插入
    if (data.length > 0) {
      const result = await prisma.countryCode.createMany({
        data,
        skipDuplicates: true,
      });
      console.log(`成功插入 ${result.count} 条记录！`);
    } else {
      console.log('没有数据需要插入');
    }

    // 验证数据
    const count = await prisma.countryCode.count();
    console.log(`\n数据库中共有 ${count} 条国家代码记录`);

    const byContinent = await prisma.countryCode.groupBy({
      by: ['continent'],
      _count: true,
    });

    console.log('\n按大洲统计:');
    for (const item of byContinent) {
      console.log(`  ${item.continent}: ${item._count} 个国家`);
    }

    // 显示每个大洲的前5个国家作为示例
    console.log('\n数据示例:');
    for (const item of byContinent) {
      const samples = await prisma.countryCode.findMany({
        where: { continent: item.continent },
        take: 5,
        orderBy: { code: 'asc' },
      });
      const codes = samples.map((s) => s.code).join(', ');
      console.log(
        `  ${item.continent}: ${codes}${item._count > 5 ? '...' : ''}`,
      );
    }

    console.log('\n数据插入完成！');
  } catch (error) {
    console.error('插入失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行插入
insertCountryCodes()
  .then(() => {
    console.log('\n脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n脚本执行失败:', error);
    process.exit(1);
  });
