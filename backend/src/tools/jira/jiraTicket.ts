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

export interface TicketUpdateDetails {
  ticketId: string;
  summary?: string;
  description?: string;
  status?: string;
  priority?: string;
  assignee?: string;
  storyPoints?: number;
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

export class JiraTicket {
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


  async createJiraTicket(details: TicketDetails): Promise<string | null | {
    key: string
  }> {

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
      return response.data;

    } catch (error) {
      console.error('Error creating JIRA ticket:', error);
      return null;
    }
  }



  // Add this method to your JiraTicket class
  async updateJiraTicket(details: TicketUpdateDetails): Promise<string | null> {
    try {
      const endpoint = `${this.jiraUrl}/rest/api/3/issue/${details.ticketId}`;
      const updateFields: any = {};

      if (details.summary) {
        updateFields.summary = details.summary;
      }
      if (details.description) {
        updateFields.description = this.markdownToAtlassianDoc(details.description);
      }
      if (details.priority) {
        updateFields.priority = { name: details.priority };
      }
      if (details.assignee) {
        updateFields.assignee = { id: details.assignee };
      }
      if (details.storyPoints && process.env.JIRA_STORY_POINTS_FIELD_ID) {
        updateFields[process.env.JIRA_STORY_POINTS_FIELD_ID] = details.storyPoints;
      }

      // Update the issue fields
      if (Object.keys(updateFields).length > 0) {
        await axios.put(
          endpoint,
          { fields: updateFields },
          { headers: this.headers, auth: this.auth }
        );
      }

      // Handle status update if provided
      if (details.status) {
        const transitionsEndpoint = `${endpoint}/transitions`;
        const transitions = await axios.get<{ transitions: { id: string; name: string }[] }>(transitionsEndpoint, {
          headers: this.headers,
          auth: this.auth
        });
        console.log(transitions.data.transitions.map((data) => data));

        const targetTransition = transitions.data.transitions.find(
          (t: any) => t.to.name.toLowerCase() === details.status?.toLowerCase()
        );
        if (targetTransition) {
          await axios.post(
            transitionsEndpoint,
            {
              transition: { id: targetTransition.id }
            },
            { headers: this.headers, auth: this.auth }
          );
        } else {
          throw new Error(`Status transition to '${details.status}' not available`);
        }
      }

      return `Successfully updated ticket ${details.ticketId}`;
    } catch (error) {
      console.error('Error updating JIRA ticket:', error);

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
        const formattedContent: any[] = [];
        let match;
        const boldRegex = /\*\*(.*?)\*\*/g;
        let lastIndex = 0;

        while ((match = boldRegex.exec(line)) !== null) {
          if (match.index > lastIndex) {
            formattedContent.push({ type: 'text', text: line.substring(lastIndex, match.index) });
          }
          formattedContent.push({ type: 'text', marks: [{ type: 'strong' }], text: match[1] });
          lastIndex = match.index + match[0].length;
        }

        if (lastIndex < line.length) {
          formattedContent.push({ type: 'text', text: line.substring(lastIndex) });
        }

        content.push({ type: 'paragraph', content: formattedContent });
      }
    });

    return { type: 'doc', version: 1, content };
  }

}
