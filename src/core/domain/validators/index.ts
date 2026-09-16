import { z } from 'zod';

// Common validators
export const idSchema = z.string().min(10).max(32);
export const paisaSchema = z.number().int().min(0).or(z.bigint());
export const milliSchema = z.number().int().min(0).or(z.bigint());
export const phoneSchema = z.string().min(11).max(15).regex(/^[0-9+\-() ]+$/, 'ফোন নম্বর সঠিক নয়');
export const emailSchema = z.string().email('ইমেইল সঠিক নয়').optional().or(z.literal(''));
export const nameSchema = z.string().min(1, 'নাম আবশ্যক').max(200, 'নাম অনেক বড়');
export const skuSchema = z.string().min(1).max(50);
export const barcodeSchema = z.string().min(4).max(48);

// Business validators
export const businessSchema = z.object({
  name: nameSchema,
  tradeName: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  phone: phoneSchema.optional(),
  email: emailSchema,
});

export const productSchema = z.object({
  name: nameSchema,
  sku: skuSchema.optional(),
  barcode: barcodeSchema.optional(),
  baseUnitId: idSchema,
  costPricePaisa: z.number().int().min(0),
  sellingPricePaisa: z.number().int().min(0),
  minStockMilli: z.number().int().min(0).optional(),
});

export const customerSchema = z.object({
  name: nameSchema,
  phone: phoneSchema.optional(),
  email: emailSchema,
  openingDuePaisa: z.number().int().min(0).optional(),
});

export const supplierSchema = z.object({
  name: nameSchema,
  phone: phoneSchema.optional(),
  email: emailSchema,
  openingPayablePaisa: z.number().int().min(0).optional(),
});

// IPC payload validators
export const ipcPayloadSchemas = {
  'app:getInfo': z.object({}),
  'app:getVersion': z.object({}),
  'db:getStatus': z.object({}),
  'auth:login': z.object({
    phone: z.string().min(1),
    password: z.string().min(1),
  }),
  'auth:loginWithPin': z.object({
    phone: z.string().min(1),
    pin: z.string().min(4).max(6),
  }),
  'auth:logout': z.object({}),
  'business:get': z.object({}),
  'settings:get': z.object({
    key: z.string().min(1),
  }),
  'settings:set': z.object({
    key: z.string().min(1),
    value: z.unknown(),
  }),
} as const;

export type IpcChannel = keyof typeof ipcPayloadSchemas;

export function validateIpcPayload(channel: string, payload: unknown): { valid: boolean; error?: string } {
  const schema = (ipcPayloadSchemas as Record<string, z.ZodSchema>)[channel];
  if (!schema) {
    return { valid: false, error: `Unknown channel: ${channel}` };
  }
  try {
    schema.parse(payload);
    return { valid: true };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { valid: false, error: e.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ') };
    }
    return { valid: false, error: String(e) };
  }
}
