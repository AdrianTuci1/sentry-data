import { useState } from "react";
import { ViewFrame } from "@/components/shell/ViewFrame";
import { CheckCircle2, Circle, ArrowRight, Server, Shield, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import "@/styles/onboarding.css";

export function OnboardingView() {
  const [steps, setSteps] = useState([
    {
      id: 1,
      title: "Configure your organization",
      description: "Setup workspaces, configure brand colors, and set up your initial telemetry profile.",
      completed: true,
      icon: <Sparkles className="h-5 w-5 text-accent" />,
    },
    {
      id: 2,
      title: "Connect telemetry integrations",
      description: "Link database streams, cloud servers, storage buckets, or APM monitoring tools.",
      completed: false,
      icon: <Server className="h-5 w-5 text-accent" />,
      active: true,
    },
    {
      id: 3,
      title: "Enable AI threat intelligence",
      description: "Turn on machine learning models to detect anomalies and flag security violations in real-time.",
      completed: false,
      icon: <Shield className="h-5 w-5 text-[#8E918F]" />,
    },
  ]);

  const toggleStep = (id) => {
    setSteps(
      steps.map((step) => {
        if (step.id === id) {
          return { ...step, completed: !step.completed };
        }
        return step;
      })
    );
  };

  return (
    <ViewFrame
      title="Getting Started"
      description="Follow these onboarding steps to configure your observability workspace and start collecting telemetry insights."
    >
      <div className="onboarding-wrapper">
        {/* Progress Card */}
        <div className="onboarding-progress-card">
          <div className="onboarding-flex-between">
            <h3 className="onboarding-card-title">Setup Progress</h3>
            <span className="onboarding-progress-text">
              {steps.filter((s) => s.completed).length} of {steps.length} completed
            </span>
          </div>
          <div className="onboarding-progress-bar-bg">
            <div
              className="onboarding-progress-bar-fill"
              style={{
                width: `${(steps.filter((s) => s.completed).length / steps.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Steps List */}
        <div className="onboarding-steps-list">
          {steps.map((step) => {
            const isCompleted = step.completed;
            const isActive = step.active && !isCompleted;
            return (
              <div
                key={step.id}
                onClick={() => toggleStep(step.id)}
                className={cn(
                  "onboarding-step-item",
                  isCompleted && "completed",
                  isActive && "active"
                )}
              >
                <div className="onboarding-step-left">
                  <div className="onboarding-step-checkbox">
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-accent" />
                    ) : (
                      <Circle className={cn("h-5 w-5 text-[#8E918F]", isActive && "text-accent")} />
                    )}
                  </div>
                  <div className="onboarding-step-meta">
                    <span className={cn("onboarding-step-title", isCompleted && "completed")}>
                      {step.title}
                    </span>
                    <span className="onboarding-step-desc">
                      {step.description}
                    </span>
                  </div>
                </div>

                <div className="onboarding-step-actions">
                  <div className="onboarding-step-icon">
                    {step.icon}
                  </div>
                  {!isCompleted && (
                    <button className="onboarding-step-arrow">
                      <ArrowRight size={14} className="text-[#090A0B]" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ViewFrame>
  );
}
