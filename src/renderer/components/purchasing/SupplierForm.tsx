import React, { useState } from 'react';
import { Input, Textarea } from '../ui/Input';
import { Button } from '../ui/Button';

interface SupplierFormData {
  name: string;
  companyName?: string;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  address?: string;
  contactPerson?: string;
  notes?: string;
  openingPayablePaisa?: number;
}

interface Props {
  initialData?: Partial<SupplierFormData>;
  onSubmit: (data: SupplierFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const SupplierForm: React.FC<Props> = ({ initialData, onSubmit, onCancel, loading }) => {
  const [form, setForm] = useState<SupplierFormData>({
    name: (initialData?.name as any) || '',
    companyName: (initialData?.companyName as any) || '',
    phone: (initialData?.phone as any) || '',
    alternatePhone: (initialData?.alternatePhone as any) || '',
    email: (initialData?.email as any) || '',
    address: (initialData?.address as any) || '',
    contactPerson: (initialData?.contactPerson as any) || '',
    notes: (initialData?.notes as any) || '',
    openingPayablePaisa: initialData?.openingPayablePaisa ? (initialData.openingPayablePaisa as number) / 100 : 0,
  } as any);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'নাম আবশ্যক';
    if (form.phone && !/^\+?[0-9\s-]{7,20}$/.test(form.phone)) e.phone = 'ফোন নম্বর সঠিক নয়';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'ইমেইল সঠিক নয়';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    const payload = {
      ...form,
      openingPayablePaisa: Math.round((form.openingPayablePaisa as any) * 100),
    };
    onSubmit(payload as any);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="সরবরাহকারীর নাম" required error={errors.name} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="যেমন: রহিম ট্রেডার্স" autoFocus />
        <Input label="কোম্পানির নাম" value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} placeholder="কোম্পানি" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input label="ফোন" error={errors.phone} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="017XXXXXXXX" />
        <Input label="বিকল্প ফোন" value={form.alternatePhone} onChange={e => setForm({ ...form, alternatePhone: e.target.value })} placeholder="018XXXXXXXX" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input label="ইমেইল" error={errors.email} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
        <Input label="যোগাযোগ ব্যক্তি" value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })} placeholder="নাম" />
      </div>

      <Input label="ঠিকানা" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="ঠিকানা" />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="প্রারম্ভিক পাওনা (৳)"
          type="number"
          step="0.01"
          value={form.openingPayablePaisa as any}
          onChange={e => setForm({ ...form, openingPayablePaisa: parseFloat(e.target.value) || 0 } as any)}
          placeholder="0.00"
          disabled={!!initialData?.name}
          hint={initialData?.name ? 'প্রারম্ভিক পাওনা শুধুমাত্র তৈরির সময়' : undefined}
        />
        <Textarea label="নোট" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="অতিরিক্ত তথ্য" rows={2} />
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-border">
        <Button type="button" variant="secondary" onClick={onCancel}>
          বাতিল
        </Button>
        <Button type="submit" loading={loading}>
          সংরক্ষণ করুন
        </Button>
      </div>
    </form>
  );
};
