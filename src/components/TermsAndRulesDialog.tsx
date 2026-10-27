import type { ReactNode } from "react";
import { Scale } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Platform rules and user policy, shown as a scrollable popup from the footer's
 * bottom bar. The dialog's built-in X button closes it.
 */

type Section = {
  heading: string;
  paragraphs: string[];
  list?: string[];
};

const SECTIONS: Section[] = [
  {
    heading: "1. Introduction and Acceptance of Rules",
    paragraphs: [
      "Welcome to PrimeCapital. These rules and policies have been established to maintain a secure, fair, transparent, and reliable environment for all registered users. Every user is expected to read, understand, and comply with these requirements when creating an account, accessing platform services, managing funds, or submitting withdrawal requests.",
      "By registering for an account or continuing to use the platform, users acknowledge that they are responsible for following these rules. The platform reserves the right to investigate suspected violations and apply reasonable measures when necessary to protect users, platform operations, and financial transactions.",
      "Our objective is to prevent abuse without unnecessarily restricting legitimate users from accessing their accounts or managing their funds.",
    ],
  },
  {
    heading: "2. Account Creation and Device Restrictions",
    paragraphs: [
      "To prevent abuse of the platform, manipulation of promotional offers, fraudulent registrations, and other activities that could affect platform integrity, each user is permitted to create and maintain a maximum of two (2) accounts on a single device.",
      "Creating additional accounts beyond this limit is prohibited unless the platform has granted prior written authorization.",
      "This restriction is intended to prevent individuals from exploiting multiple accounts to obtain unfair advantages, bypass account restrictions, manipulate platform activities, or interfere with services intended for legitimate users.",
      "Users must not attempt to bypass the device restriction by repeatedly deleting and reinstalling the application, manipulating device identifiers, using unauthorized automation, or employing other technical methods to evade account limits.",
      "Consequences of violating this rule: If the platform detects activity that reasonably indicates a violation, it may temporarily restrict new registrations from the affected device, request additional verification, limit certain account functions, or suspend accounts associated with the suspected activity while the matter is investigated.",
      "Where a violation is confirmed, the platform may impose a proportionate device-level restriction or other appropriate penalty. Serious or repeated violations may result in account suspension or termination, subject to applicable law and the platform's review procedures.",
      "However, sharing a device with a family member, using a shared computer, or accessing an account from a new device does not automatically establish abuse. Users must have a reasonable opportunity to explain legitimate circumstances before a significant penalty is imposed.",
    ],
  },
  {
    heading: "3. Withdrawal Request Frequency",
    paragraphs: [
      "To maintain an orderly withdrawal process, protect users against unauthorized transactions, and reduce the risk of automated withdrawal abuse, users must comply with the following withdrawal limits.",
      "Maximum withdrawal requests: four (4) within any rolling 60-minute period. Users must not submit more than four withdrawal requests during any rolling one-hour window. The limit applies to withdrawal requests submitted through the platform, regardless of whether the requests are approved, pending, or subsequently rejected.",
      "For example, if a user submits four withdrawal requests between 10:00 AM and 10:45 AM, the user must wait until enough time has passed for the earlier requests to fall outside the rolling 60-minute window before submitting another request.",
      "Users are encouraged to review their available balance, withdrawal address, network selection, transaction fees, and withdrawal amount before submitting a request.",
      "Repeatedly submitting withdrawal requests, cancelling them, and immediately submitting new ones to circumvent the limit is prohibited.",
      "If a user reaches the withdrawal limit, the platform may temporarily disable additional withdrawal submissions until the applicable time window has passed. This restriction should not automatically result in account suspension or forfeiture of funds.",
      "Where additional security verification is necessary, the platform may request confirmation of account ownership or transaction details before processing a withdrawal.",
    ],
  },
  {
    heading: "4. Accurate Account Information and Identity Verification",
    paragraphs: [
      "Users must provide accurate information when registering and must update their account details when material information changes.",
      "Providing false names, fabricated contact details, misleading identity information, or documents belonging to another person is prohibited.",
      "Where identity verification is required for security, legal compliance, or transaction processing, users must provide legitimate and readable documentation through the platform's approved verification process.",
      "Users must not create accounts using another person's identity without proper authorization.",
      "If inconsistencies are identified, the platform may request clarification or additional documentation. Restrictions should be proportionate to the circumstances, and users should be informed of the reason for a verification request whenever legally and operationally possible.",
    ],
  },
  {
    heading: "5. Account Sharing and Unauthorized Access",
    paragraphs: [
      "Each user is responsible for maintaining the security of their account credentials.",
      "Users must not sell, rent, transfer, or provide unauthorized access to their accounts. Allowing another person to use an account to bypass registration restrictions, identity verification, withdrawal controls, or other security measures is prohibited.",
      "Users should use strong passwords, protect their email accounts, and enable available security features such as two-factor authentication.",
      "If a user suspects unauthorized access, they should contact customer support promptly.",
      "The platform may temporarily restrict suspicious activity to protect the account while an investigation is conducted. Such restrictions should be reviewed promptly, particularly when they affect access to funds.",
    ],
  },
  {
    heading: "6. Transaction Accuracy and Withdrawal Details",
    paragraphs: [
      "Users are responsible for reviewing transaction information before authorizing a transfer.",
      "For cryptocurrency withdrawals, users should verify the destination wallet address, supported blockchain network, asset type, and applicable transaction fee.",
      "Transactions sent to an incorrect address or incompatible network may be irreversible. The platform will make reasonable efforts to assist with transaction inquiries, but recovery cannot be guaranteed.",
      "Users must not knowingly submit false transaction references, alter payment receipts, or misrepresent the status of a transaction.",
      "If a transaction appears delayed, duplicated, or incorrect, users should contact support and provide the relevant transaction reference rather than submitting repeated requests without checking the existing status.",
    ],
  },
  {
    heading: "7. Withdrawal Processing and Security Reviews",
    paragraphs: [
      "Withdrawal processing times may vary depending on transaction volume, network congestion, verification requirements, maintenance, and other operational factors.",
      "The platform may conduct additional reviews when a transaction presents a legitimate security, fraud-prevention, or compliance concern.",
      "Where a review is necessary, the platform should communicate the status of the request and any reasonable steps required from the user, subject to applicable legal restrictions.",
      "A pending withdrawal must not automatically be treated as evidence of wrongdoing.",
      "The platform must not impose arbitrary delays or use repeated verification requests to prevent legitimate users from accessing their funds. Any restriction on withdrawals must have a legitimate basis and remain consistent with applicable law and the platform's published terms.",
    ],
  },
  {
    heading: "8. Prohibited Technical Circumvention",
    paragraphs: [
      "Users must not intentionally circumvent platform security controls, device limits, rate limits, verification requirements, or access restrictions.",
      "Examples include manipulating device fingerprints to evade an established restriction, repeatedly creating accounts after suspension, exploiting API endpoints to submit unauthorized transactions, or interfering with security monitoring systems.",
      "The platform may use reasonable security signals, including device and session information, to identify suspicious patterns.",
      "However, a shared IP address, public Wi-Fi connection, VPN usage, or shared device should not, on its own, be treated as conclusive proof of fraud. Security decisions should consider the overall circumstances and allow legitimate users to resolve mistaken restrictions.",
    ],
  },
  {
    heading: "9. Investigation, Penalties, and Appeals",
    paragraphs: [
      "When a potential violation is detected, the platform may review relevant account activity, transaction records, device signals, and other information lawfully collected for security purposes.",
      "Possible measures include:",
    ],
    list: [
      "A warning or request for clarification.",
      "Additional identity or account verification.",
      "Temporary restrictions on specific account functions.",
      "Temporary device-level registration restrictions.",
      "Removal of improperly obtained promotional benefits.",
      "Temporary account suspension while a serious incident is investigated.",
      "Account termination for confirmed serious or repeated violations, where justified.",
    ],
  },
  {
    heading: "9b. Appeals and Limits",
    paragraphs: [
      "The measure selected should reflect the seriousness of the violation, the available evidence, the user's history, and any relevant explanation provided.",
      "Where practicable, users should be notified of significant enforcement decisions and given a reasonable opportunity to appeal.",
      "A device restriction must not automatically be used to punish every person who later uses that device. The platform should distinguish between the individual responsible for a violation and unrelated legitimate users whenever reasonably possible.",
      "Nothing in this policy authorizes the platform to impose unlawful financial penalties, confiscate legitimate funds without a valid legal basis, or deny users rights provided by applicable law.",
    ],
  },
  {
    heading: "10. Customer Support and Dispute Resolution",
    paragraphs: [
      "Users who believe their account has been incorrectly restricted, their withdrawal has been delayed, or a rule has been applied unfairly may contact the platform's official customer support team.",
      "When submitting a complaint, users should provide their account reference, relevant transaction identification, a description of the problem, and any supporting evidence requested through an approved channel.",
      "Users must not send passwords, private keys, seed phrases, or other highly sensitive authentication secrets to customer support.",
      "The platform will make reasonable efforts to investigate complaints and provide a clear response within an appropriate timeframe.",
      "Users should cooperate with legitimate security inquiries while retaining the right to challenge an incorrect decision.",
    ],
  },
  {
    heading: "11. Final Statement",
    paragraphs: [
      "These rules are designed to protect the integrity of the platform, reduce fraudulent activity, maintain reliable withdrawal operations, and ensure fair treatment for legitimate users.",
      "All users are expected to act honestly, respect security controls, provide accurate information, and use the platform responsibly.",
      "By continuing to use the platform, users acknowledge that violations may lead to proportionate restrictions or other enforcement measures consistent with these rules and applicable law.",
      "Our commitment is to maintain a secure and dependable platform while protecting legitimate users from fraud, abuse, and unfair treatment.",
    ],
  },
];

export function TermsAndRulesDialog({ children }: { children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <Scale className="h-4 w-4 shrink-0 text-primary" />
            Terms &amp; Conditions
          </DialogTitle>
          <DialogDescription>
            Platform rules and user policy. Please read and scroll through all sections.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[62vh] overflow-y-auto pr-2">
          <div className="space-y-6">
            {SECTIONS.map((section) => (
              <section key={section.heading} className="space-y-2">
                <h3 className="font-display text-sm font-semibold text-foreground">
                  {section.heading}
                </h3>
                {section.paragraphs.map((paragraph, index) => (
                  <p
                    key={`${section.heading}-${index}`}
                    className="text-xs leading-relaxed text-muted-foreground"
                  >
                    {paragraph}
                  </p>
                ))}
                {section.list && (
                  <ol className="ml-4 list-decimal space-y-1 text-xs leading-relaxed text-muted-foreground">
                    {section.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                )}
              </section>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
