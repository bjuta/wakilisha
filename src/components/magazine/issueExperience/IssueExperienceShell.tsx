import { Link } from 'react-router-dom';
import type { MagazineIssue } from '@/services/magazineIssues';
import type { MagazineIssueExperience } from '@/services/magazineIssueEngine';
import { ListeningIssueExperience } from './ListeningIssueExperience';
import { SceneIssueExperience } from './SceneIssueExperience';
import { RecordReviewIssueExperience } from './RecordReviewIssueExperience';
import { FieldGuideIssueExperience } from './FieldGuideIssueExperience';
import { MemoryIssueExperience } from './MemoryIssueExperience';
import { SystemsIssueExperience } from './SystemsIssueExperience';
import { ImageIssueExperience } from './ImageIssueExperience';
import { ArgumentIssueExperience } from './ArgumentIssueExperience';
import { MixedIssueExperience } from './MixedIssueExperience';
import { ThinIssueExperience } from './ThinIssueExperience';
import './issueExperience.css';

export type IssueExperienceComponentProps = {
  issue: MagazineIssue;
  experience: MagazineIssueExperience;
  previousHref?: string;
  previousLabel?: string;
  nextHref?: string;
  nextLabel?: string;
};

export function IssueExperienceShell(props: IssueExperienceComponentProps) {
  const { issue, experience } = props;

  const Component = (() => {
    switch (experience.archetype) {
      case 'listeningIssue':
        return ListeningIssueExperience;
      case 'sceneIssue':
        return SceneIssueExperience;
      case 'recordReviewIssue':
        return RecordReviewIssueExperience;
      case 'fieldGuideIssue':
        return FieldGuideIssueExperience;
      case 'memoryIssue':
        return MemoryIssueExperience;
      case 'systemsIssue':
        return SystemsIssueExperience;
      case 'imageIssue':
        return ImageIssueExperience;
      case 'argumentIssue':
        return ArgumentIssueExperience;
      case 'thinIssue':
        return ThinIssueExperience;
      case 'mixedCultureIssue':
      default:
        return MixedIssueExperience;
    }
  })();

  return (
    <div
      className={`magazine-shell mag-issue-experience-shell mag-issue-${experience.archetype} mag-pattern-${experience.interactionPattern}`}
      data-issue-archetype={experience.archetype}
      data-interaction-pattern={experience.interactionPattern}
    >
      <div className="mag-experience-chrome">
        <Link to="/magazine/issues" className="magazine-backlink">
          Back to the magazine
        </Link>
        <div className="magazine-meta" style={{ textAlign: 'right' }}>
          {experience.archetypeLabel}
          <br />
          {experience.issueCta}
        </div>
      </div>
      <Component {...props} issue={issue} experience={experience} />
    </div>
  );
}
