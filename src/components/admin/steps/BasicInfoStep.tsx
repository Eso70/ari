"use client";

import { memo, useState, useMemo } from "react";
import { X, Upload, Layout } from "lucide-react";
import Image from "next/image";
import { BACKGROUND_COLORS, GRADIENT_HEX_MAP, DEFAULT_FOOTER_PHONE } from "../modal-constants";
import { TEMPLATE_OPTIONS, type TemplateKey } from "@/lib/templates/config";
import { TemplateSelector } from "../TemplateSelector";

interface BasicInfoStepProps {
  profileImagePreview: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  name: string;
  subtitle: string;
  slug: string;
  backgroundColor: string;
  templateKey: TemplateKey;
  footerText: string;
  footerPhone: string;
  footerHidden: boolean;
  errors: {
    name?: string;
    slug?: string;
    backgroundColor?: string;
    templateKey?: string;
    footerPhone?: string;
    image?: string;
  };
  touched: {
    name?: boolean;
    slug?: boolean;
    backgroundColor?: boolean;
    templateKey?: boolean;
    footerPhone?: boolean;
  };
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onNameChange: (value: string) => void;
  onNameBlur: () => void;
  onSubtitleChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onBackgroundColorChange: (value: string) => void;
  onBackgroundColorBlur: () => void;
  onTemplateKeyChange: (value: TemplateKey) => void;
  onFooterTextChange: (value: string) => void;
  onFooterPhoneChange: (value: string) => void;
  onFooterHiddenChange: (value: boolean) => void;
}

// Memoized color button component
const ColorButton = memo(function ColorButton({
  color,
  isSelected,
  hasError,
  onClick,
  onBlur,
}: {
  color: typeof BACKGROUND_COLORS[0];
  isSelected: boolean;
  hasError: boolean;
  onClick: () => void;
  onBlur: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onBlur={onBlur}
      className={`relative h-8 w-full overflow-hidden rounded-md border-2 transition-all duration-200 ${
        isSelected
          ? "border-yellow-600 scale-110 ring-2 ring-yellow-600/50 shadow-lg shadow-yellow-600/30 z-10"
          : hasError
          ? "border-yellow-400 ring-2 ring-yellow-400/20"
          : "border-gray-300 hover:border-gray-400 hover:scale-105"
      }`}
      title={color.name}
    >
      {color.isSolid ? (
        <div 
          className="background-swatch h-full w-full rounded" 
          style={{ background: color.value }} 
        />
      ) : (
        <div
          className="background-swatch h-full w-full rounded"
          style={{
            background: GRADIENT_HEX_MAP[color.value]
              ? `linear-gradient(to bottom right, ${GRADIENT_HEX_MAP[color.value].from}, ${GRADIENT_HEX_MAP[color.value].via}, ${GRADIENT_HEX_MAP[color.value].to})`
              : color.value,
          }}
        />
      )}
    </button>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.hasError === nextProps.hasError &&
    prevProps.color.id === nextProps.color.id
  );
});

ColorButton.displayName = "ColorButton";

export const BasicInfoStep = memo(function BasicInfoStep({
  profileImagePreview,
  fileInputRef,
  name,
  subtitle,
  slug,
  backgroundColor,
  templateKey,
  footerText,
  footerPhone,
  footerHidden,
  errors,
  touched,
  onImageChange,
  onRemoveImage,
  onNameChange,
  onNameBlur,
  onSubtitleChange,
  onSlugChange,
  onBackgroundColorChange,
  onBackgroundColorBlur,
  onTemplateKeyChange,
  onFooterTextChange,
  onFooterPhoneChange,
  onFooterHiddenChange,
}: BasicInfoStepProps) {
  const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = useState(false);
  
  // Memoize selected template lookup
  const selectedTemplate = useMemo(() => {
    return TEMPLATE_OPTIONS.find(t => t.id === templateKey);
  }, [templateKey]);

  return (
    <>
      <div className="space-y-5">
      {/* Profile Image Upload */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <label className="relative h-32 w-32 overflow-hidden rounded-full border-2 border-gray-300 bg-white cursor-pointer transition-all duration-200 hover:border-gray-400 hover:scale-105 group block shadow-md">
            <Image
              src={profileImagePreview || "/images/DefaultAvatar.png"}
              alt="Profile preview"
              width={128}
              height={128}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Upload className="h-8 w-8 text-white" />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onImageChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </label>
          {((profileImagePreview && profileImagePreview !== "/images/DefaultAvatar.png")) && (
            <button
              type="button"
              onClick={onRemoveImage}
              className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-lg z-10"
              aria-label="Remove image"
              title="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {errors.image && (
          <p className="text-xs text-red-600 text-center font-kurdish">{errors.image}</p>
        )}
        <label className="group relative flex cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg sm:rounded-xl px-5 sm:px-6 py-2.5 sm:py-3 text-sm font-medium text-white shadow-md hover:shadow-lg transition-all duration-200" style={{ background: '#eab308' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#ca8a04'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#eab308'; }}>
          <Upload className="h-4 w-4" />
          <span>وێنەی پڕۆفایل هەڵبژێرە</span>
          <input
            type="file"
            accept="image/*"
            onChange={onImageChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </label>
      </div>

      {/* Name and Subtitle */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5">
          <label htmlFor="name" className="block text-xs sm:text-sm font-medium text-gray-700">
            ناو <span className="text-yellow-600">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onBlur={onNameBlur}
            required
            className={`w-full rounded-lg sm:rounded-xl border bg-white px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:outline-none focus:ring-2 ${
              errors.name && touched.name
                ? "border-yellow-500 focus:border-yellow-500 focus:ring-yellow-500/30"
                : "border-gray-300 focus:border-yellow-500 focus:ring-yellow-500/30 hover:border-gray-400"
            }`}
            placeholder="ناوی لینک"
          />
          {errors.name && touched.name && (
            <p className="text-xs text-red-600 mt-1 font-kurdish">{errors.name}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="subtitle" className="block text-xs sm:text-sm font-medium text-gray-700">
            ناونیشانی کورت
          </label>
          <input
            id="subtitle"
            type="text"
            value={subtitle}
            onChange={(e) => onSubtitleChange(e.target.value)}
            className="w-full rounded-lg sm:rounded-xl border border-gray-300 bg-white px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/30 hover:border-gray-400"
            placeholder="ناونیشانی کورت"
          />
        </div>
      </div>

      {/* Slug and Template Style - Side by Side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Slug */}
        <div className="space-y-1.5">
          <label htmlFor="slug" className="block text-xs sm:text-sm font-medium text-gray-700">
            Slug
          </label>
          <input
            id="slug"
            type="text"
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
            disabled
            className={`w-full rounded-lg sm:rounded-xl border bg-gray-50 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-500 placeholder:text-gray-400 transition-all focus:outline-none focus:ring-2 cursor-not-allowed ${
              errors.slug && touched.slug
                ? "border-yellow-500 focus:border-yellow-500 focus:ring-yellow-500/30"
                : "border-gray-300 focus:border-gray-400 focus:ring-gray-400/20"
            }`}
            placeholder="slug"
          />
          {errors.slug && touched.slug && (
            <p className="text-xs text-red-600 mt-1 font-kurdish">{errors.slug}</p>
          )}
        </div>

        {/* Template Style */}
        <div className="space-y-1.5" data-template-section>
          <label className="block text-xs sm:text-sm font-medium text-gray-700">
            شێوازی پەڕە <span className="text-yellow-600">*</span>
          </label>
          <button
            type="button"
            onClick={() => setIsTemplateSelectorOpen(true)}
            className={`relative w-full rounded-lg sm:rounded-xl border bg-white px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-left transition-all duration-200 flex items-center justify-between gap-2 ${
              errors.templateKey && touched.templateKey
                ? "border-yellow-500"
                : "border-gray-300 hover:border-gray-400"
            }`}
          >
            {selectedTemplate ? (
              <span className="text-gray-900 truncate">{selectedTemplate.name}</span>
            ) : (
              <span className="text-gray-400">شێوازێک هەڵبژێرە</span>
            )}
            <Layout className="h-4 w-4 text-gray-500 flex-shrink-0" />
          </button>
          {errors.templateKey && touched.templateKey && (
            <p className="text-xs text-red-600 mt-1 font-kurdish">{errors.templateKey}</p>
          )}
        </div>
      </div>

      {/* Background Color */}
      <div className="space-y-1.5">
        <label className="block text-xs sm:text-sm font-medium text-gray-700">
          ڕەنگی پاشبنەوە
        </label>
        <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-14 gap-1.5">
          {BACKGROUND_COLORS.map((color) => (
            <ColorButton
              key={color.id}
              color={color}
              isSelected={backgroundColor === color.id}
              hasError={!!(errors.backgroundColor && touched.backgroundColor)}
              onClick={() => onBackgroundColorChange(color.id)}
              onBlur={onBackgroundColorBlur}
            />
          ))}
        </div>
        {errors.backgroundColor && touched.backgroundColor && (
          <p className="text-xs text-red-600 mt-1 font-kurdish">{errors.backgroundColor}</p>
        )}
      </div>

      {/* Footer Name and Phone */}
      <div className="space-y-3 sm:space-y-4">
        {/* Hide Footer Toggle - Custom Toggle Switch */}
        <div className="flex items-center justify-between gap-2 sm:gap-3 md:gap-4 p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white hover:border-gray-300 transition-all duration-200 touch-manipulation">
          <label 
            htmlFor="footerHidden" 
            className="text-xs sm:text-sm md:text-base font-medium text-gray-700 cursor-pointer flex-1 leading-tight sm:leading-normal pr-2 sm:pr-0"
            onClick={() => onFooterHiddenChange(!footerHidden)}
          >
            فوتەر بشارەوە (فوتەر لە پەڕەکە نیشان نادرێت)
          </label>
          <button
            type="button"
            role="switch"
            aria-checked={footerHidden}
            aria-label={footerHidden ? "فوتەر شاردراوە" : "فوتەر نیشاندراوە"}
            onClick={() => onFooterHiddenChange(!footerHidden)}
            className={`relative inline-flex h-7 w-12 sm:h-8 sm:w-14 md:h-9 md:w-16 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 touch-manipulation active:scale-95 ${
              footerHidden ? 'bg-yellow-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                footerHidden ? 'translate-x-5 sm:translate-x-6 md:translate-x-7' : 'translate-x-0.5 sm:translate-x-0.5 md:translate-x-1'
              }`}
            />
          </button>
        </div>

        {!footerHidden && (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5">
              <label htmlFor="footerText" className="block text-xs sm:text-sm font-medium text-gray-700">
            ناوی فوتەر (کلیک بکە بۆ واتساپ)
          </label>
          <input
            id="footerText"
            type="text"
            value={footerText}
            onChange={(e) => onFooterTextChange(e.target.value)}
                className="w-full rounded-lg sm:rounded-xl border border-gray-300 bg-white px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/30 hover:border-gray-400"
            placeholder="Ari"
          />
        </div>
        <div className="space-y-1.5">
              <label htmlFor="footerPhone" className="block text-xs sm:text-sm font-medium text-gray-700">
            ژمارەی واتساپ (ئیختیاری)
          </label>
          <input
            id="footerPhone"
            type="text"
            value={footerPhone}
            onChange={(e) => onFooterPhoneChange(e.target.value)}
                className={`w-full rounded-lg sm:rounded-xl border bg-white px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:outline-none focus:ring-2 ${
              errors.footerPhone && touched.footerPhone
                    ? "border-yellow-500 focus:border-yellow-500 focus:ring-yellow-500/30"
                    : "border-gray-300 focus:border-yellow-500 focus:ring-yellow-500/30 hover:border-gray-400"
            }`}
            placeholder={DEFAULT_FOOTER_PHONE}
          />
          {errors.footerPhone && touched.footerPhone && (
                <p className="text-xs text-red-600 mt-1 font-kurdish">{errors.footerPhone}</p>
          )}
        </div>
          </div>
        )}
      </div>
    </div>

    <TemplateSelector
      isOpen={isTemplateSelectorOpen}
      onClose={() => setIsTemplateSelectorOpen(false)}
      selectedTemplate={templateKey}
      onSelectTemplate={onTemplateKeyChange}
    />
    </>
  );
});
