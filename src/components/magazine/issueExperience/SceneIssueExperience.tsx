import { IssueOpening } from './IssueOpening';
import { IssuePath } from './IssuePath';
import { IssueSignalBoard } from './IssueSignalBoard';
import { IssueBackMatter } from './IssueBackMatter';
import type { IssueExperienceComponentProps } from './IssueExperienceShell';

export function SceneIssueExperience(props: IssueExperienceComponentProps) {
  const { issue, experience } = props;
  return (
    <div className="mag-issue-experience mag-issue-experience-scene">
      <IssueOpening issue={issue} experience={experience} eyebrow="Scene issue" />
      <section className="mag-issue-zone mag-reveal mag-experience-room mag-scene-room" id={`${issue.id}-enter-the-room`}>
        <div className="mag-room-inner">
          <div className="magazine-meta">Enter the room</div>
          <h2>Rooms, routes, stages and the people inside them.</h2>
          <p>{experience.readerPromise}</p>
          <p>{experience.visualPromise}</p>
        </div>
      </section>
      <IssuePath issue={issue} experience={experience} />
      <IssueSignalBoard issue={issue} experience={experience} />
      <IssueBackMatter {...props} />
    </div>
  );
}
