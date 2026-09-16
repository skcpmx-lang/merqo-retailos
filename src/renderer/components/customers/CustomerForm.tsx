import React, { useState } from 'react';
import { Input } from '../ui/Input';
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
    name: initialData?.name || '',
    companyName: initialData?.companyName || '',
    phone: initialData?.phone || '',
    alternatePhone: initialData?.alternatePhone || '',
    email: initialData?.email || '',
    address: initialData?.address || '',
    contactPerson: initialData?.contactPerson || '',
    notes: initialData?.notes || '',
    openingDuePaisa: initialData?.openingDuePaisa ? (initialData.openingDuePaisa as any) / 100 : 0,
    creditLimitPaisa: initialData?.creditLimitPaisa ? (initialData.creditLimitPaisa as any) / 100 : 0,
  } as any);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'গ্রাহকের নাম লিখুন';
    if (form.phone && !/^\+?[0-9\s-]{7,20}$/.test(form.phone)) e.phone = 'সঠিক ফোন নম্বর দিন';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'সঠিক ইমেইল দিন';
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
        <div>
          <label className="text-label text-text-primary mb-1 block">গ্রাহকের নাম *</label>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="যেমন: করিম স্টোর" />
          {errors.name && <p className="text-caption text-danger-500 mt-1">{errors.name}</p>}
        </div>
        <div>
          <label className="text-label text-text-primary mb-1 block">কোম্পানি/দোকানের নাম</label>
          <Input value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} placeholder="কোম্পানি" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-label text-text-primary mb-1 block">ফোন</label>
          <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="017XXXXXXXX" />
          {errors.phone && <p className="text-caption text-danger-500 mt-1">{errors.phone}</p>}
        </div>
        <div>
          <label className="text-label text-text-primary mb-1 block">বিকল্প ফোন</label>
          <Input value={form.alternatePhone} onChange={e => setForm({ ...form, alternatePhone: e.target.value })} placeholder="018XXXXXXXX" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-label text-text-primary mb-1 block">ইমেইল</label>
          <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
          {errors.email && <p className="text-caption text-danger-500 mt-1">{errors.email}</p>}
        </div>
        <div>
          <label className="text-label text-text-primary mb-1 block">যোগাযোগ ব্যক্তি</label>
          <Input value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })} placeholder="নাম" />
        </div>
      </div>

      <div>
        <label className="text-label text-text-primary mb-1 block">ঠিকানা</label>
        <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="ঠিকানা" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-label text-text-primary mb-1 block">প্রারম্ভিক বকেয়া (৳)</label>
          <Input type="number" step="0.01" value={form.openingDuePaisa as any} onChange={e => setForm({ ...form, openingDuePaisa: parseFloat(e.target.value) || 0 } as any)} placeholder="0.00" disabled={!!initialData?.name} />
          {initialData?.name && <p className="text-caption text-text-tertiary mt-1">শুধুমাত্র তৈরির সময়</p>}
        </div>
        <div>
          <label className="text-label text-text-primary mb-1 block">ক্রেডিট লিমিট (৳)</label>
          <Input type="number" step="0.01" value={form.creditLimitPaisa as any} onChange={e => setForm({ ...form, creditLimitPaisa: parseFloat(e.target.value) || 0 } as any)} placeholder="0 = সীমাহীন" />
        </div>
        <div>
          <label className="text-label text-text-primary mb-1 block">নোট</label>
          <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="অতিরিক্ত তথ্য" />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>বাতিল</Button>
        <Button type="submit" loading={loading}>সংরক্ষণ করুন</Button>
      </div>
    </form>
  );
};
