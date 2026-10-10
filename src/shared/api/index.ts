// Yagona API qatlami — YANGI Gateway (api.yolyolakay.com, 2026-07-18).
// Swagger = haqiqat manbasi: /api/v1/docs (admin/admin).
export { api, unwrap } from './client';
export { getDeviceId, deviceHeaders, OS_TYPE } from './device';
export { buildWsUrl } from './ws';

export * as authApi from './auth';
export * as usersApi from './users';
export * as ridesApi from './rides';
export * as billingApi from './billing';
export * as notificationsApi from './notifications';
export * as ratingApi from './rating';
export * as mediaApi from './media';
export * as parcelsApi from './parcels';

export * from './types';
