import { computeMetrics, normalizeProcessSpec } from './engine.js';

// Built-in prompts & reference specifications matching the 3 case studies in this repository
// plus additional ready-to-try domain prompts.

export const PRESETS = [
  {
    id: 'loan',
    title: 'Loan Application Process (Repo Case Study)',
    shortTitle: 'Loan Application Process',
    category: 'Repository Case Study',
    folder: 'Loan Process/',
    summary:
      'Consolidates 4 lending variants (Standard branch, Digital fast-track, Legacy paper-file, and High-risk rejected) across 6 stages.',
    prompt: `Loan Application Process
Stages: intake, credit check, document verification, assessment, decision, and archiving.
V1 (Standard branch): Receive Request -> Check Credit System -> Verify Documents -> Assess Manually -> Accept Loan -> Archive Request
V2 (Digital fast-track): Receive Request -> Check Credit System -> Verify Documents -> Auto-Approve Check -> Accept Loan
V3 (Legacy paper-file): Receive Request -> Check Paper Archive -> Verify Documents -> Assess Manually -> Accept Loan -> Archive Request
V4 (High-risk rejected): Receive Request -> Check Credit System -> Verify Documents -> Assess Manually -> Reject Loan`,
    referenceSpec: {
      processName: 'Loan Application Process',
      overview:
        'The loan application process spans six stages: intake, credit check, document verification, assessment, decision, and archiving.',
      stages: [
        {
          id: 'Intake',
          name: 'Intake',
          activities: [{ id: 'ReceiveRequest', name: 'Receive Request' }],
        },
        {
          id: 'Credit',
          name: 'Credit Source',
          defaultBranch: 'CheckCreditSystem',
          activities: [
            { id: 'CheckCreditSystem', name: 'Check Credit System', branchLabel: 'Digital / Standard' },
            { id: 'CheckPaperArchive', name: 'Check Paper Archive', branchLabel: 'Legacy' },
          ],
        },
        {
          id: 'Verify',
          name: 'Document Verification',
          activities: [{ id: 'VerifyDocuments', name: 'Verify Documents' }],
        },
        {
          id: 'Assessment',
          name: 'Assessment Mode',
          defaultBranch: 'AssessManually',
          activities: [
            { id: 'AssessManually', name: 'Assess Manually', branchLabel: 'Standard / High-risk' },
            { id: 'AutoApproveCheck', name: 'Auto-Approve Check', branchLabel: 'Low-risk / Digital' },
          ],
        },
        {
          id: 'Decision',
          name: 'Loan Decision',
          defaultBranch: 'AcceptLoan',
          activities: [
            { id: 'AcceptLoan', name: 'Accept Loan', branchLabel: 'Eligible' },
            { id: 'RejectLoan', name: 'Reject Loan', branchLabel: 'Ineligible' },
          ],
        },
        {
          id: 'Archive',
          name: 'Archive?',
          defaultBranch: 'SKIP',
          bypassLabel: 'Digital / Rejected',
          activities: [{ id: 'ArchiveRequest', name: 'Archive Request', branchLabel: 'Branch dossier' }],
        },
      ],
      variants: [
        {
          code: 'V1',
          name: 'Standard branch',
          choices: {
            Intake: 'ReceiveRequest',
            Credit: 'CheckCreditSystem',
            Verify: 'VerifyDocuments',
            Assessment: 'AssessManually',
            Decision: 'AcceptLoan',
            Archive: 'ArchiveRequest',
          },
        },
        {
          code: 'V2',
          name: 'Digital fast-track',
          choices: {
            Intake: 'ReceiveRequest',
            Credit: 'CheckCreditSystem',
            Verify: 'VerifyDocuments',
            Assessment: 'AutoApproveCheck',
            Decision: 'AcceptLoan',
            Archive: 'SKIP',
          },
        },
        {
          code: 'V3',
          name: 'Legacy paper-file',
          choices: {
            Intake: 'ReceiveRequest',
            Credit: 'CheckPaperArchive',
            Verify: 'VerifyDocuments',
            Assessment: 'AssessManually',
            Decision: 'AcceptLoan',
            Archive: 'ArchiveRequest',
          },
        },
        {
          code: 'V4',
          name: 'High-risk rejected',
          choices: {
            Intake: 'ReceiveRequest',
            Credit: 'CheckCreditSystem',
            Verify: 'VerifyDocuments',
            Assessment: 'AssessManually',
            Decision: 'RejectLoan',
            Archive: 'SKIP',
          },
        },
      ],
    },
  },
  {
    id: 'university',
    title: 'University Admission Process (Repo Case Study)',
    shortTitle: 'University Admission Process',
    category: 'Repository Case Study',
    folder: 'University Admission Process/',
    summary:
      'Merges 4 admission workflows (Standard, Online Fast-Track, Legacy Paper-Based, Rejected) including a 3-way hybrid assessment split.',
    prompt: `University Admission Process
Stages: application submission, eligibility check, assessment (exam/interview or skipped), merit evaluation, admission decision, and enrollment.
V1 (Standard Admission): Submit Application -> Check Eligibility (Manual) -> Conduct Entrance Exam -> Evaluate Merit (Committee) -> Offer Admission -> Enroll Student
V2 (Online Fast-Track): Submit Application -> Check Eligibility (Automated) -> Evaluate Merit (Automated) -> Offer Admission
V3 (Legacy Paper-Based): Submit Application -> Check Eligibility (Manual) -> Conduct Interview -> Evaluate Merit (Committee) -> Offer Admission -> Enroll Student
V4 (Rejected Application): Submit Application -> Check Eligibility (Manual) -> Conduct Entrance Exam -> Evaluate Merit (Committee) -> Reject Application`,
    referenceSpec: {
      processName: 'University Admission Process',
      overview:
        'The university admission process spans six stages: application submission, eligibility check, assessment (exam/interview), merit evaluation, admission decision, and enrollment.',
      stages: [
        {
          id: 'Submit',
          name: 'Application Submission',
          activities: [{ id: 'SubmitApplication', name: 'Submit Application' }],
        },
        {
          id: 'Eligibility',
          name: 'Eligibility Check',
          defaultBranch: 'CheckEligibilityManual',
          activities: [
            { id: 'CheckEligibilityManual', name: 'Check Eligibility (Manual)', branchLabel: 'Manual (V1,V3,V4)' },
            { id: 'CheckEligibilityAutomated', name: 'Check Eligibility (Automated)', branchLabel: 'Automated (V2)' },
          ],
        },
        {
          id: 'Assessment',
          name: 'Assessment Mode',
          defaultBranch: 'ConductEntranceExam',
          bypassLabel: 'Skip (V2)',
          activities: [
            { id: 'ConductEntranceExam', name: 'Conduct Entrance Exam', branchLabel: 'Exam (V1,V4)' },
            { id: 'ConductInterview', name: 'Conduct Interview', branchLabel: 'Interview (V3)' },
          ],
        },
        {
          id: 'Merit',
          name: 'Merit Evaluation',
          defaultBranch: 'EvaluateMeritCommittee',
          activities: [
            { id: 'EvaluateMeritCommittee', name: 'Evaluate Merit (Committee)', branchLabel: 'Committee (V1,V3,V4)' },
            { id: 'EvaluateMeritAutomated', name: 'Evaluate Merit (Automated)', branchLabel: 'Automated (V2)' },
          ],
        },
        {
          id: 'Decision',
          name: 'Admission Decision',
          defaultBranch: 'OfferAdmission',
          activities: [
            { id: 'OfferAdmission', name: 'Offer Admission', branchLabel: 'Offer (V1,V2,V3)' },
            { id: 'RejectApplication', name: 'Reject Application', branchLabel: 'Reject (V4)' },
          ],
        },
        {
          id: 'Enroll',
          name: 'Enrollment?',
          defaultBranch: 'SKIP',
          bypassLabel: 'Skip (V2,V4)',
          activities: [{ id: 'EnrollStudent', name: 'Enroll Student', branchLabel: 'Enroll (V1,V3)' }],
        },
      ],
      variants: [
        {
          code: 'V1',
          name: 'Standard Admission',
          choices: {
            Submit: 'SubmitApplication',
            Eligibility: 'CheckEligibilityManual',
            Assessment: 'ConductEntranceExam',
            Merit: 'EvaluateMeritCommittee',
            Decision: 'OfferAdmission',
            Enroll: 'EnrollStudent',
          },
        },
        {
          code: 'V2',
          name: 'Online Fast-Track',
          choices: {
            Submit: 'SubmitApplication',
            Eligibility: 'CheckEligibilityAutomated',
            Assessment: 'SKIP',
            Merit: 'EvaluateMeritAutomated',
            Decision: 'OfferAdmission',
            Enroll: 'SKIP',
          },
        },
        {
          code: 'V3',
          name: 'Legacy Paper-Based',
          choices: {
            Submit: 'SubmitApplication',
            Eligibility: 'CheckEligibilityManual',
            Assessment: 'ConductInterview',
            Merit: 'EvaluateMeritCommittee',
            Decision: 'OfferAdmission',
            Enroll: 'EnrollStudent',
          },
        },
        {
          code: 'V4',
          name: 'Rejected Application',
          choices: {
            Submit: 'SubmitApplication',
            Eligibility: 'CheckEligibilityManual',
            Assessment: 'ConductEntranceExam',
            Merit: 'EvaluateMeritCommittee',
            Decision: 'RejectApplication',
            Enroll: 'SKIP',
          },
        },
      ],
    },
  },
  {
    id: 'recruitment',
    title: 'Employee Recruitment Process (Repo Case Study)',
    shortTitle: 'Employee Recruitment Process',
    category: 'Repository Case Study',
    folder: 'Employee Recruitment Process/',
    summary:
      'Unifies 4 hiring pipelines (Standard Corporate, Remote Fast-Track, Legacy Paper-Dossier, Rejected Candidate) into 1 flexible model.',
    prompt: `Employee Recruitment Process
Stages: application intake, screening, credential verification, assessment, hiring decision, and orientation.
V1 (Standard Corporate Hire): Receive Application -> Screen Resume -> Verify Credentials -> Conduct Panel Interview -> Extend Job Offer -> Conduct Orientation
V2 (Remote Fast-Track Hire): Receive Application -> Screen Resume -> Verify Credentials -> Run Automated Assessment -> Extend Job Offer
V3 (Legacy Paper-Dossier Hire): Receive Application -> Review Paper Dossier -> Verify Credentials -> Conduct Panel Interview -> Extend Job Offer -> Conduct Orientation
V4 (Rejected Candidate): Receive Application -> Screen Resume -> Verify Credentials -> Conduct Panel Interview -> Reject Candidate`,
    referenceSpec: {
      processName: 'Employee Recruitment Process',
      overview:
        'The employee recruitment process spans six stages: application intake, screening, credential verification, assessment, hiring decision, and orientation.',
      stages: [
        {
          id: 'Intake',
          name: 'Application Intake',
          activities: [{ id: 'ReceiveApplication', name: 'Receive Application' }],
        },
        {
          id: 'Screening',
          name: 'Screening Source',
          defaultBranch: 'ScreenResume',
          activities: [
            { id: 'ScreenResume', name: 'Screen Resume', branchLabel: 'Digital / Standard' },
            { id: 'ReviewPaperDossier', name: 'Review Paper Dossier', branchLabel: 'Legacy' },
          ],
        },
        {
          id: 'Verify',
          name: 'Credential Verification',
          activities: [{ id: 'VerifyCredentials', name: 'Verify Credentials' }],
        },
        {
          id: 'Assessment',
          name: 'Assessment Mode',
          defaultBranch: 'ConductPanelInterview',
          activities: [
            { id: 'ConductPanelInterview', name: 'Conduct Panel Interview', branchLabel: 'Standard / Rejected' },
            { id: 'RunAutomatedAssessment', name: 'Run Automated Assessment', branchLabel: 'Remote Fast-Track' },
          ],
        },
        {
          id: 'Decision',
          name: 'Hiring Decision',
          defaultBranch: 'ExtendJobOffer',
          activities: [
            { id: 'ExtendJobOffer', name: 'Extend Job Offer', branchLabel: 'Selected' },
            { id: 'RejectCandidate', name: 'Reject Candidate', branchLabel: 'Not Selected' },
          ],
        },
        {
          id: 'Orientation',
          name: 'Orientation?',
          defaultBranch: 'SKIP',
          bypassLabel: 'Remote / Rejected',
          activities: [{ id: 'ConductOrientation', name: 'Conduct Orientation', branchLabel: 'In-person onboarding' }],
        },
      ],
      variants: [
        {
          code: 'V1',
          name: 'Standard Corporate Hire',
          choices: {
            Intake: 'ReceiveApplication',
            Screening: 'ScreenResume',
            Verify: 'VerifyCredentials',
            Assessment: 'ConductPanelInterview',
            Decision: 'ExtendJobOffer',
            Orientation: 'ConductOrientation',
          },
        },
        {
          code: 'V2',
          name: 'Remote Fast-Track Hire',
          choices: {
            Intake: 'ReceiveApplication',
            Screening: 'ScreenResume',
            Verify: 'VerifyCredentials',
            Assessment: 'RunAutomatedAssessment',
            Decision: 'ExtendJobOffer',
            Orientation: 'SKIP',
          },
        },
        {
          code: 'V3',
          name: 'Legacy Paper-Dossier Hire',
          choices: {
            Intake: 'ReceiveApplication',
            Screening: 'ReviewPaperDossier',
            Verify: 'VerifyCredentials',
            Assessment: 'ConductPanelInterview',
            Decision: 'ExtendJobOffer',
            Orientation: 'ConductOrientation',
          },
        },
        {
          code: 'V4',
          name: 'Rejected Candidate',
          choices: {
            Intake: 'ReceiveApplication',
            Screening: 'ScreenResume',
            Verify: 'VerifyCredentials',
            Assessment: 'ConductPanelInterview',
            Decision: 'RejectCandidate',
            Orientation: 'SKIP',
          },
        },
      ],
    },
  },
  {
    id: 'ecommerce',
    title: 'E-Commerce Order Fulfillment (Natural Language)',
    shortTitle: 'E-Commerce Order Fulfillment',
    category: 'Natural Language Sample',
    prompt: `In our E-Commerce Order Fulfillment process, every order starts with Receive Order and Check Inventory.
For payment, customers either Pay by Card or use Cash on Delivery (for local orders).
Then we Pack Order, except cancelled out-of-stock orders which skip packing and instead Cancel & Refund Order.
Fulfilled orders go through either Standard Courier, Express Same-Day Delivery, or Store Pickup.
Optionally, corporate accounts also Receive GST Tax Invoice at the end.`,
  },
  {
    id: 'hospital',
    title: 'Hospital Patient Triage (Structured Variants)',
    shortTitle: 'Hospital Patient Triage',
    category: 'Natural Language Sample',
    prompt: `Hospital Emergency Triage Process
V1 (Walk-In Outpatient): Register Patient -> Measure Vitals -> General Physician Consult -> Prescribe Medication -> Discharge Patient
V2 (Ambulance Critical): Emergency Pre-Arrival Alert -> Stabilize Airway -> Trauma Specialist Consult -> Admit to ICU
V3 (Telemedicine Screening): Register Patient -> Measure Vitals -> Remote Video Consult -> Prescribe Medication
V4 (Left Without Being Seen): Register Patient -> Measure Vitals -> Record Early Departure`,
  },
];

export function listPresets() {
  return PRESETS.map(({ id, title, shortTitle, category, folder, summary, prompt, referenceSpec }) => {
    let referenceMeta = null;
    if (referenceSpec) {
      const normalized = normalizeProcessSpec(referenceSpec);
      const metrics = computeMetrics(normalized);
      referenceMeta = {
        folder: folder || '',
        summary: summary || normalized.overview,
        variants: normalized.variants.map((v) => ({ code: v.code, name: v.name })),
        metrics: {
          diagrams: `${metrics.rigid.diagrams} → ${metrics.flexible.diagrams}`,
          diagramsDelta: metrics.changes.diagrams,
          activities: `${metrics.rigid.activityNodes} → ${metrics.flexible.activityNodes}`,
          activitiesDelta: metrics.changes.activityNodes,
          totalNodes: `${metrics.rigid.totalNodes} → ${metrics.flexible.totalNodes}`,
          totalNodesDelta: metrics.changes.totalNodes,
          sequenceFlows: `${metrics.rigid.sequenceFlows} → ${metrics.flexible.sequenceFlows}`,
          sequenceFlowsDelta: metrics.changes.sequenceFlows,
        },
      };
    }

    return {
      id,
      title,
      shortTitle: shortTitle || title,
      category,
      prompt,
      hasReferenceSpec: Boolean(referenceSpec),
      referenceMeta,
    };
  });
}

export function getPresetById(id) {
  return PRESETS.find((p) => p.id === id) || null;
}
