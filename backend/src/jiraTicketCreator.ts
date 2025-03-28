import axios from 'axios';
import { OpenAI } from 'openai';

export interface TicketDetails {
  project: string;
  issueType: string;
  summary: string;
  description: string;
  priority: string;
  storyPoints?: number;
  parentKey?: string;
  sprintId?: string;
}
export interface JiraBoard {
  id: number;
  self: string;
  name: string;
  type: 'scrum' | 'kanban';
  location: JiraLocation;
  isPrivate: boolean;
}

interface JiraResponse {
  key: string;
}

export interface JiraLocation {
  projectId: number;
  displayName: string;
  projectName: string;
  projectKey: string;
  projectTypeKey: string;
  avatarURI: string;
  name: string;
}

export interface JiraBoardResponse {
  id: number;
  values: JiraBoard[];
}

interface AIResponse {
  issueType: string;
  project: string;
  priority: string;
  storyPoints: number;
  description: string;
  parentKey: string | "None";
}

export class JiraTicketCreator {
  private jiraUrl: string;
  private auth: { username: string; password: string };
  private assigneeAccountId: string;
  private headers: Record<string, string>;
  private openai: OpenAI;

  constructor(
    jiraUrl: string,
    username: string,
    apiToken: string,
    assigneeAccountId: string,
    openaiApiKey: string
  ) {
    this.jiraUrl = jiraUrl;
    this.auth = { username, password: apiToken };
    this.assigneeAccountId = assigneeAccountId;
    this.headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    this.openai = new OpenAI({ apiKey: openaiApiKey });
  }


  async getCurrentActiveSprint(projectKey: string): Promise<number | null> {
    try {
      // First, find the board associated with the project
      const boardResponse = await axios.get<JiraBoardResponse>(`${this.jiraUrl}/rest/agile/1.0/board`, {
        headers: this.headers,
        auth: this.auth,
        params: {
          projectKeyOrId: projectKey
        }
      });

      // Find the first board that matches the project key exactly
      const board = boardResponse.data.values.find(
        (b: any) => b.location?.projectKey === projectKey
      );

      if (!board) {
        return null;
      }
      const boardId = board.id;
      if (!boardId) {
        return null;
      }

      const sprintsResponse = await axios.get(`${this.jiraUrl}/rest/agile/1.0/board/${boardId}/sprint`, {
        headers: this.headers,
        auth: this.auth,
        params: {
          state: 'active'
        }
      });

      // Return the ID of the active sprint
      return (sprintsResponse as any).data.values[0]?.id || null;

    } catch (error) {
      console.error('Error fetching current sprint:', error);
      return null;
    }
  }


  async createJiraTicket(details: TicketDetails): Promise<string | null> {

    // Find the active Sprint ID
    const sprintId = await this.getCurrentActiveSprint(details.project);

    try {
      const endpoint = `${this.jiraUrl}/rest/api/3/issue`;
      const payload = {
        fields: {
          project: { key: details.project },
          summary: details.summary,
          description: this.markdownToAtlassianDoc(details.description),
          issuetype: { name: details.issueType },
          priority: { name: details.priority },
          assignee: { id: this.assigneeAccountId },
          ...(process.env.JIRA_STORY_POINTS_FIELD_ID && { [process.env.JIRA_STORY_POINTS_FIELD_ID]: details.storyPoints }),
          ...(details.parentKey && { parent: { key: details.parentKey } }),
        },
      };


      const response = await axios.post<JiraResponse>(endpoint, payload, { headers: this.headers, auth: this.auth });

      if (response.status !== 201) {
        return (`Error creating JIRA ticket:, ${response.data}`);
      }

      if (!sprintId) {
        return 'Issue created, but no active sprint found to assign it to.';
      }

      await axios.post(`${this.jiraUrl}/rest/agile/1.0/sprint/${sprintId}/issue`,
        {
          issues: [response.data.key]
        },
        {
          headers: this.headers,
          auth: this.auth
        }
      );
      return (`Issue ${response.data.key} created and assigned to sprint ${sprintId}`);

    } catch (error) {
      console.error('Error creating JIRA ticket:', error);
      return null;
    }
  }

  private markdownToAtlassianDoc(markdown: string) {
    const lines = markdown.split('\n');
    const content: any[] = [];

    lines.forEach(line => {
      if (line.trim() === '') return;
      if (line.startsWith('# ')) {
        content.push({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: line.substring(2) }] });
      } else if (line.startsWith('- [ ] ')) {
        content.push({ type: 'taskList', content: [{ type: 'taskItem', attrs: { state: 'TODO' }, content: [{ type: 'text', text: line.substring(6) }] }] });
      } else {
        content.push({ type: 'paragraph', content: [{ type: 'text', text: line }] });
      }
    });

    return { type: 'doc', version: 1, content };
  }
}
