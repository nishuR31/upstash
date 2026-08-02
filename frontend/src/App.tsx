import React, { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import SplashScreen from "./components/SplashScreen";
import Lightfall from "./components/Lightfall";
import ConfirmModal from "./components/ConfirmModal";
import HomeTab from "./components/HomeTab";
import OverviewTab from "./components/OverviewTab";
import ClustersTab from "./components/ClustersTab";
import ProvisionerTab from "./components/ProvisionerTab";
import DiagnosticsTab from "./components/DiagnosticsTab";
import SettingsTab from "./components/SettingsTab";
import NotFoundTab from "./components/NotFoundTab";
import { DatabaseItem, ToastItem, ToastType, ShaderSettings, EngineSettings } from "./types";

function AppContent() {
  const [databases, setDatabases] = useState<DatabaseItem[]>([]);
  const [selectedDiagUrl, setSelectedDiagUrl] = useState("");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const location = useLocation();

  // Confirm delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingDeleteDbName, setPendingDeleteDbName] = useState<string | null>(null);

  // Fast splash screen timer
  useEffect(() => {
    const timer = setTimeout(() => setIsInitializing(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const showToast = useCallback((msg: string, type: ToastType = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const copyToClipboard = useCallback((text: string, label: string) => {
    if (!text) {
      showToast(`No ${label} available to copy!`, "warn");
      return;
    }
    navigator.clipboard.writeText(text);
    showToast(`Copied ${label} to clipboard!`, "success");
  }, [showToast]);

  const loadDatabases = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/databases");
      if (!res.ok) return;
      const data = await res.json();
      const dbList = data.data || data.databases || [];
      if (Array.isArray(dbList)) {
        setDatabases(dbList);
      }
    } catch (err) {
      console.error("Failed to load databases:", err);
    }
  }, []);

  useEffect(() => {
    loadDatabases();
  }, [loadDatabases]);

  const onRequestDelete = (dbName: string) => {
    setPendingDeleteDbName(dbName);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteDbName) return;
    try {
      const res = await fetch("/api/v1/databases/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: pendingDeleteDbName }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Successfully deleted database link for "${pendingDeleteDbName}"`, "success");
        loadDatabases();
      } else {
        showToast(data.message || data.error || "Failed to delete database link.", "error");
      }
    } catch (err) {
      showToast("Network error deleting database link.", "error");
    } finally {
      setDeleteModalOpen(false);
      setPendingDeleteDbName(null);
    }
  };

  // Shader & Engine Settings State
  const [shaderSettings, setShaderSettings] = useState<ShaderSettings>({
    speed: 0.4,
    glow: 0.8,
    density: 0.5,
    theme: "cyber",
  });

  const [engineSettings, setEngineSettings] = useState<EngineSettings>({
    userAgent: "Chrome-Headless-132",
    concurrency: 4,
    timeoutSec: 30,
    proxyRotation: false,
    autoRetry: true,
  });

  const isNotFound = !["/", "/clusters", "/provisioner", "/diagnostics", "/settings"].includes(location.pathname);

  if (isInitializing && !isNotFound) {
    return <SplashScreen />;
  }

  // Theme color mapper
  const getThemeColors = () => {
    switch (shaderSettings.theme) {
      case "neon":
        return ["#FF9FFC", "#9D00FF", "#00F0FF"];
      case "matrix":
        return ["#00FF87", "#60EFFF", "#00B894"];
      case "gold":
        return ["#FFD700", "#FF4500", "#FF8C00"];
      case "cyber":
      default:
        return ["#A6C8FF", "#5227FF", "#FF9FFC"];
    }
  };

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden bg-[#040508]">
      {/* Lightfall WebGL background shader for all main pages */}
      <div className="fixed inset-0 w-screen h-screen min-h-screen pointer-events-none overflow-hidden z-0">
        <Lightfall
          colors={getThemeColors()}
          backgroundColor="#040508"
          speed={shaderSettings.speed}
          streakCount={2}
          streakWidth={1}
          streakLength={1}
          glow={shaderSettings.glow}
          density={shaderSettings.density}
          twinkle={1}
          zoom={3}
          backgroundGlow={shaderSettings.glow * 0.4}
          opacity={0.9}
          mouseInteraction
          mouseStrength={0.4}
          mouseRadius={1}
          color1={getThemeColors()[0]}
          color2={getThemeColors()[1]}
          color3={getThemeColors()[2]}
        />
      </div>

      <Navbar databasesCount={databases.length} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 relative z-10">
        <Routes>
          <Route path="/" element={<HomeTab databases={databases} />} />

          <Route
            path="/clusters"
            element={
              <>
                <OverviewTab
                  databases={databases}
                  loadDatabases={loadDatabases}
                  showToast={showToast}
                  copyToClipboard={copyToClipboard}
                  setSelectedDiagUrl={setSelectedDiagUrl}
                />
                <div className="pt-8">
                  <ClustersTab
                    databases={databases}
                    showToast={showToast}
                    copyToClipboard={copyToClipboard}
                    onRequestDelete={onRequestDelete}
                  />
                </div>
              </>
            }
          />

          <Route
            path="/provisioner"
            element={
              <ProvisionerTab
                showToast={showToast}
                loadDatabases={loadDatabases}
              />
            }
          />

          <Route
            path="/diagnostics"
            element={
              <DiagnosticsTab
                databases={databases}
                selectedDiagUrl={selectedDiagUrl}
                setSelectedDiagUrl={setSelectedDiagUrl}
                showToast={showToast}
              />
            }
          />

          <Route
            path="/settings"
            element={
              <SettingsTab
                showToast={showToast}
                databases={databases}
                shaderSettings={shaderSettings}
                setShaderSettings={setShaderSettings}
                engineSettings={engineSettings}
                setEngineSettings={setEngineSettings}
              />
            }
          />

          {/* Instant Wildcard 404 Route - Direct Synchronous Render without Loader */}
          <Route path="*" element={<NotFoundTab />} />
        </Routes>
      </main>

      <Footer showToast={showToast} />

      {/* Global Toast Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-2xl text-xs font-semibold shadow-2xl flex items-center gap-2.5 backdrop-blur-xl border animate-slide-in ${
              t.type === "success"
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                : t.type === "error"
                ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                : t.type === "warn"
                ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                : "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
            }`}
          >
            <span className="font-extrabold text-sm">
              {t.type === "success" ? "[OK]" : t.type === "error" ? "[ERR]" : t.type === "warn" ? "[WARN]" : "[INFO]"}
            </span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        dbName={pendingDeleteDbName}
        onClose={() => {
          setDeleteModalOpen(false);
          setPendingDeleteDbName(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
