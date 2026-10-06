import { NextResponse } from 'next/server';
import { billingConfigured, priceId } from '../../../lib/server/billing';
import { PAID_PLANS } from '../../../lib/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Welche Tarife online buchbar sind. */
export async function GET() {
  return NextResponse.json({
    enabled: billingConfigured(),
    prices: Object.fromEntries(PAID_PLANS.map((p) => [p, { monthly: !!priceId(p, 'monthly'), yearly: !!priceId(p, 'yearly') }])),
  });
}
