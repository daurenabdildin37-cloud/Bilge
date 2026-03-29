import { useState, useMemo } from 'react';
import { KMZHParams, KMZHData, AssessmentData } from '../types';

export function useKmzh() {
  const [kmzhLoading, setKmzhLoading] = useState(false);
  const [kmzhResult, setKmzhResult] = useState<KMZHData | null>(null);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentData | null>(null);
  const [kmzhParams, setKmzhParams] = useState<KMZHParams>({
    subject: 'Математика',
    grade: '5',
    topic: '',
    learningObjectives: '',
    section: '',
    teacherName: '',
    schoolName: '',
    date: new Date().toLocaleDateString(),
    value: 'Бірлік және ынтымақ',
    quote: 'Білім — таусылмайтын кен.',
    participants: '25',
    absent: '0',
    time: '45',
    lang: 'Қазақша',
    bloom: ['Білу', 'Түсіну'],
    additionalRequests: '',
    sourceText: '',
  });

  return useMemo(() => ({
    kmzhLoading,
    setKmzhLoading,
    kmzhResult,
    setKmzhResult,
    assessmentResult,
    setAssessmentResult,
    kmzhParams,
    setKmzhParams
  }), [kmzhLoading, kmzhResult, assessmentResult, kmzhParams]);
}
