import { NextResponse } from 'next/server';
import { billingConfigured, priceId } from '../../../lib/server/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Welche Tarife online buchbar sind. */
export async function GET() {
  return NextResponse.json({
    enabled: billingConfigured(),
    prices: {
      business: { monthly: !!priceId('business', 'monthly'), yearly: !!priceId('business', 'yearly') },
      team: { monthly: !!priceId('team', 'monthly'), yearly: !!priceId('team', 'yearly') },
    },
  });
}
