import React, { useState } from 'react';
import { Input, Textarea } from '../ui/Input';
import { Button } from '../ui/Button';

interface CustomerFormData {
  name: string;
  companyName?: string;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  address?: string;
  contactPerson?: string;
  notes?: string;
  openingDuePaisa?: number;
  creditLimitPaisa?: number;
}

interface Props {
  initialData?: Partial<CustomerFormData>;
  onSubmit: (data: CustomerFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const CustomerForm: React.FC<Props> = ({ initialData, onSubmit, onCancel, loading }) => {
  const [form, setForm] = useState<CustomerFormData>({
    name: (initialData?.name as any) || '',
    companyName: (initialData?.companyName as any) || '',
    phone: (initialData?.phone as any) || '',
    alternatePhone: (initialData?.alternatePhone as any) || '',
    email: (initialData?.email as any) || '',
    address: (initialData?.address as any) || '',
    contactPerson: (initialData?.contactPerson as any) || '',
    notes: (initialData?.notes as any) || '',
    openingDuePaisa: initialData?.openingDuePaisa ? (initialData.openingDuePaisa as any) / 100 : 0,
    creditLimitPaisa: initialData?.creditLimitPaisa ? (initialData.creditLimitPaisa as any) / 100 : 0,
  } as any);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'গ্রাহকের নাম আবশ্যক';
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
      openingDuePaisa: Math.round((form.openingDuePaisa as any) * 100),
      creditLimitPaisa: Math.round((form.creditLimitPaisa as any) * 100),
    };
    onSubmit(payload as any);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="গ্রাহকের নাম" required error={errors.name} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="যেমন: করিম স্টোর" autoFocus />
        <Input label="কোম্পানি / দোকানের নাম" value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} placeholder="কোম্পানি" />
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

      <div className="grid grid-cols-3 gap-4">
        <Input label="প্রারম্ভিক বকেয়া (৳)" type="number" step="0.01" value={form.openingDuePaisa as any} onChange={e => setForm({ ...form, openingDuePaisa: parseFloat(e.target.value) || 0 } as any)} placeholder="0.00" disabled={!!initialData?.name} hint={initialData?.name ? 'শুধুমাত্র তৈরির সময়' : undefined} />
        <Input label="ক্রেডিট লিমিট (৳)" type="number" step="0.01" value={form.creditLimitPaisa as any} onChange={e => setForm({ ...form, creditLimitPaisa: parseFloat(e.target.value) || 0 } as any)} placeholder="0 = সীমাহীন" hint="0 মানে সীমাহীন" />
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
