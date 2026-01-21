"use client";

export type QuoteFormData = {
  companyName: string;
  systemName: string;
};

type QuoteFormProps = {
  value: QuoteFormData;
  onChange: (patch: Partial<QuoteFormData>) => void;
  disabled?: boolean;
  companyDisabled?: boolean;
  systemDisabled?: boolean;
};

export default function QuoteForm({
  value,
  onChange,
  disabled = false,
  companyDisabled = false,
  systemDisabled = false,
}: QuoteFormProps) {
  const isCompanyDisabled = disabled || companyDisabled;
  const isSystemDisabled = disabled || systemDisabled;
  const update = <K extends keyof QuoteFormData>(
    key: K,
    newValue: QuoteFormData[K],
  ) => onChange({ [key]: newValue });

  return (
    <div className="form-block">
      <div className="row">
        <label htmlFor="companyName">
          ชื่อบริษัท<span className="required">*</span>
        </label>
        <input
          id="companyName"
          name="companyName"
          type="text"
          required={!isCompanyDisabled}
          disabled={isCompanyDisabled}
          value={value.companyName}
          onChange={(e) => update("companyName", e.target.value)}
          placeholder="เช่น บริษัท เจเจแซทส์ โซลูชัน จำกัด"
        />
      </div>
      <div className="row">
        <label htmlFor="systemName">ระบบ</label>
        <input
          id="systemName"
          name="systemName"
          type="text"
          disabled={isSystemDisabled}
          value={value.systemName}
          onChange={(e) => update("systemName", e.target.value)}
          placeholder="เช่น ระบบไฟฟ้า, ระบบกล้อง, ฯลฯ"
        />
      </div>
    </div>
  );
}
