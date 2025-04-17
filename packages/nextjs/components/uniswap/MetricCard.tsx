// components/MetricCard.tsx
"use client";
import React from "react";

interface MetricCardProps {
  label: string;
  value: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({ label, value }) => (
  <div className="bg-white p-4 rounded-lg shadow">
    <h4 className="text-sm font-medium text-gray-500">{label}</h4>
    <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
  </div>
);