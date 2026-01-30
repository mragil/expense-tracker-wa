import { db } from './index';
import { vouchers } from './schema';

async function seed() {
  console.log('Seeding database...');
  try {
    await db.insert(vouchers).values({
      code: 'START123',
      isUsed: false,
    });
    console.log('Voucher START123 added.');
  } catch (e) {
    console.error('Seed notification: Voucher START123 might already exist.');
  }
}

seed();
