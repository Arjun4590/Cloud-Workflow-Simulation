import React, { useState } from "react";
import { X, Sliders, CheckCircle2, AlertCircle, Info, Cpu, RefreshCw } from "lucide-react";
import { useSimulationStore } from "../../store/simulationStore";
import type { AutoscalingConfig } from "../../engines/simulation/autoscaling/AutoscalingTypes";
import { validateAutoscalingConfig, DEFAULT_AUTOSCALING_CONFIG } from "../../engines/simulation/autoscaling/AutoscalingTypes";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function AutoscalingSettingsModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;
  return <AutoscalingModalContent onClose={onClose} />;
}

function AutoscalingModalContent({ onClose }: { onClose: () => void }) {
  const { snapshot, setAutoscalingConfig, toggleAutoscaling, isPlaying } = useSimulationStore();
  const currentConfig: AutoscalingConfig = snapshot?.config.autoscaling || DEFAULT_AUTOSCALING_CONFIG;

  const [form, setForm] = useState<AutoscalingConfig>({ ...currentConfig });
  const [errors, setErrors] = useState<string[]>([]);

  const handleFieldChange = (field: keyof AutoscalingConfig, value: any) => {
    const updated = { ...form, [field]: value };
    setForm(updated);

    const validation = validateAutoscalingConfig(updated);
    setErrors(validation.errors);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateAutoscalingConfig(form);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setAutoscalingConfig(form);
    onClose();
  };

  const handleResetDefaults = () => {
    setForm({ ...DEFAULT_AUTOSCALING_CONFIG, enabled: form.enabled });
    setErrors([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <Sliders size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Autoscaling Policy & Thresholds</h2>
              <p className="text-[11px] text-slate-500">Configure simulated cluster elasticity, thresholds, and cooldowns</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Active Mode Banner */}
          <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
            <div>
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <Cpu size={14} className="text-indigo-600" />
                <span>Autoscaling Engine Mode</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {form.enabled 
                  ? "Elastic: replicas scale out/in dynamically based on concurrent request load."
                  : "Fixed: backend replicas remain at fixed capacity throughout the simulation."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                toggleAutoscaling();
                setForm(prev => ({ ...prev, enabled: !prev.enabled }));
              }}
              className={`px-3 py-1.5 rounded-md font-bold text-xs shadow-xs transition-colors ${
                form.enabled 
                  ? "bg-indigo-600 text-white hover:bg-indigo-700" 
                  : "bg-slate-200 text-slate-700 hover:bg-slate-300"
              }`}
            >
              {form.enabled ? "ENABLED" : "DISABLED"}
            </button>
          </div>

          {isPlaying && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-md text-[11px] text-amber-800 flex items-center gap-2">
              <Info size={14} className="text-amber-600 flex-shrink-0" />
              <span>Simulation is currently running. Policy adjustments apply on the next logical clock tick.</span>
            </div>
          )}

          {/* Validation Errors Box */}
          {errors.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md space-y-1">
              <div className="font-bold text-red-800 flex items-center gap-1.5">
                <AlertCircle size={14} className="text-red-600" />
                <span>Configuration Validation Errors:</span>
              </div>
              <ul className="list-disc list-inside text-red-700 space-y-0.5">
                {errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Replica Bounds Section */}
          <div className="space-y-2">
            <h3 className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">1. Capacity & Replica Boundaries</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Min Replicas</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={form.minReplicas}
                  onChange={(e) => handleFieldChange("minReplicas", parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400">Floor capacity</span>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Initial Replicas</label>
                <input
                  type="number"
                  min={form.minReplicas}
                  max={form.maxReplicas}
                  value={form.initialReplicas}
                  onChange={(e) => handleFieldChange("initialReplicas", parseInt(e.target.value) || form.minReplicas)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400">Boot capacity</span>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Max Replicas</label>
                <input
                  type="number"
                  min={form.minReplicas}
                  max="20"
                  value={form.maxReplicas}
                  onChange={(e) => handleFieldChange("maxReplicas", parseInt(e.target.value) || form.minReplicas)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400">Ceiling limit</span>
              </div>
            </div>
          </div>

          {/* Utilization Thresholds Section */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <h3 className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">2. Elastic Scaling Thresholds</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-slate-700">Scale-Out Threshold</label>
                  <span className="font-bold text-indigo-700 font-mono text-xs">{form.scaleOutThreshold}%</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="100"
                  step="5"
                  value={form.scaleOutThreshold}
                  onChange={(e) => handleFieldChange("scaleOutThreshold", parseInt(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 block mt-1">Triggers +{form.scaleOutIncrement} replica when load &ge; {form.scaleOutThreshold}%</span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-slate-700">Scale-In Threshold</label>
                  <span className="font-bold text-emerald-700 font-mono text-xs">{form.scaleInThreshold}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="70"
                  step="5"
                  value={form.scaleInThreshold}
                  onChange={(e) => handleFieldChange("scaleInThreshold", parseInt(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 block mt-1">Triggers -{form.scaleInDecrement} replica when load &le; {form.scaleInThreshold}%</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-200 italic">
              Hysteresis gap: {form.scaleOutThreshold - form.scaleInThreshold}% margin between scale-out and scale-in prevents rapid flip-flop oscillation.
            </div>
          </div>

          {/* Cooldowns and Timing Section */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <h3 className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">3. Cooldown & Startup Delays</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Scale-Out Cooldown</label>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={form.scaleOutCooldown}
                    onChange={(e) => handleFieldChange("scaleOutCooldown", parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono text-slate-800"
                  />
                  <span className="text-slate-500 text-[10px]">ticks</span>
                </div>
                <span className="text-[10px] text-slate-400">Wait after scale-out</span>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Scale-In Cooldown</label>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={form.scaleInCooldown}
                    onChange={(e) => handleFieldChange("scaleInCooldown", parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono text-slate-800"
                  />
                  <span className="text-slate-500 text-[10px]">ticks</span>
                </div>
                <span className="text-[10px] text-slate-400">Wait after scale-in</span>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Startup Delay</label>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={form.startupDelayTicks}
                    onChange={(e) => handleFieldChange("startupDelayTicks", parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono text-slate-800"
                  />
                  <span className="text-slate-500 text-[10px]">ticks</span>
                </div>
                <span className="text-[10px] text-slate-400">Boot provisioning time</span>
              </div>
            </div>
          </div>

          {/* Modeled Capacity per Instance */}
          <div className="space-y-1.5 pt-2 border-t border-slate-200">
            <h3 className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">4. Instance Capacity Model</h3>
            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded border border-slate-200">
              <div>
                <div className="font-semibold text-slate-700">Simulated Capacity Per Replica</div>
                <div className="text-[10px] text-slate-500">Max concurrent requests each backend replica serves before 100% saturation</div>
              </div>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={form.modeledCapacityPerReplica}
                  onChange={(e) => handleFieldChange("modeledCapacityPerReplica", parseInt(e.target.value) || 1)}
                  className="w-16 bg-white border border-slate-300 rounded px-2 py-1 font-mono text-slate-800 font-bold text-center"
                />
                <span className="text-slate-500 text-[10px]">reqs</span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="text-slate-500 hover:text-slate-700 flex items-center gap-1 font-medium text-[11px]"
            >
              <RefreshCw size={12} /> Reset Defaults
            </button>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-md font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={errors.length > 0}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-md font-bold shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle2 size={13} /> Save Configuration
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
