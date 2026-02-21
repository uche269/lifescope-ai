import React, { useState } from 'react';
import { Target, HeartPulse, Wallet, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

interface OnboardingWizardProps {
    onComplete: () => void;
    userName: string;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete, userName }) => {
    const [step, setStep] = useState(1);

    const steps = [
        {
            id: 1,
            title: `Welcome to LifeScope, ${userName}!`,
            description: "You're about to transform how you manage your life. LifeScope is a complete operating system for your health, wealth, and personal growth. Let's set up your focus areas.",
            icon: Sparkles,
            color: "text-indigo-400",
            bg: "bg-indigo-500/20"
        },
        {
            id: 2,
            title: "Health & Wellness",
            description: "Your health is your foundation. In LifeScope, you can track your weight, log your meals with AI photo analysis, and get personalized meal plans.",
            icon: HeartPulse,
            color: "text-emerald-400",
            bg: "bg-emerald-500/20"
        },
        {
            id: 3,
            title: "Financial Confidence",
            description: "Take control of your money. Log your income and expenses, set budgets, and ask the AI financial assistant for personalized insights.",
            icon: Wallet,
            color: "text-amber-400",
            bg: "bg-amber-500/20"
        },
        {
            id: 4,
            title: "Goal Setting",
            description: "Everything ties back to your goals. You can link your financial and health targets directly to your core life goals so progress updates automatically.",
            icon: Target,
            color: "text-red-400",
            bg: "bg-red-500/20"
        }
    ];

    const currentStep = steps[step - 1];
    const Icon = currentStep.icon;

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in zoom-in duration-500">
            <div className="glass-panel p-8 md:p-12 rounded-3xl max-w-2xl w-full text-center relative overflow-hidden">
                {/* Progress bar */}
                <div className="absolute top-0 left-0 h-1 bg-slate-800 w-full">
                    <div
                        className="h-full bg-indigo-500 transition-all duration-500"
                        style={{ width: `${(step / steps.length) * 100}%` }}
                    />
                </div>

                <div className="flex justify-center mb-8">
                    <div className={`p-4 rounded-2xl ${currentStep.bg} animate-bounce-slow`}>
                        <Icon className={`w-12 h-12 ${currentStep.color}`} />
                    </div>
                </div>

                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{currentStep.title}</h2>
                <p className="text-slate-400 text-lg leading-relaxed mb-10 max-w-lg mx-auto">
                    {currentStep.description}
                </p>

                <div className="flex justify-center gap-4">
                    {step > 1 && (
                        <button
                            onClick={() => setStep(step - 1)}
                            className="px-6 py-3 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                        >
                            Back
                        </button>
                    )}

                    <button
                        onClick={() => {
                            if (step < steps.length) {
                                setStep(step + 1);
                            } else {
                                onComplete();
                            }
                        }}
                        className="px-8 py-3 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/25"
                    >
                        {step === steps.length ? (
                            <>Let's get started <CheckCircle2 className="w-5 h-5" /></>
                        ) : (
                            <>Continue <ArrowRight className="w-5 h-5" /></>
                        )}
                    </button>
                </div>

                {/* Dots */}
                <div className="flex justify-center gap-2 mt-8">
                    {steps.map((s) => (
                        <div
                            key={s.id}
                            className={`w-2 h-2 rounded-full transition-all duration-300 ${s.id === step ? 'bg-indigo-500 w-6' : 'bg-slate-700'}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default OnboardingWizard;
