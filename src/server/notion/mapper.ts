import type { PageObjectResponse, PartialPageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import type { ProductBacklogItem } from '@/domain/pbi';

type QueryDatabaseResult = {
  results: Array<PageObjectResponse | PartialPageObjectResponse>;
};

const isFullPage = (
  page: PageObjectResponse | PartialPageObjectResponse,
): page is PageObjectResponse => page.object === 'page' && 'properties' in page;

const pickTitle = (page: PageObjectResponse, propertyName: string) => {
  const property = page.properties[propertyName];
  if (property?.type === 'title') {
    return property.title.map((t) => t.plain_text).join('') || 'Untitled';
  }
  return 'Untitled';
};

const pickSelect = (page: PageObjectResponse, propertyName: string) => {
  const property = page.properties[propertyName];
  if (property?.type === 'select') {
    return property.select?.name ?? null;
  }
  if (property?.type === 'status') {
    return property.status?.name ?? null;
  }
  return null;
};

const pickNumber = (page: PageObjectResponse, propertyName: string) => {
  const property = page.properties[propertyName];
  if (property?.type === 'number') {
    return property.number ?? null;
  }
  return null;
};

const pickPeople = (page: PageObjectResponse, propertyName: string) => {
  const property = page.properties[propertyName];
  if (property?.type === 'people') {
    const person = property.people[0];
    if (!person) {
      return null;
    }
    if ('name' in person && typeof person.name === 'string' && person.name) {
      return person.name;
    }
    if ('person' in person && person.person && 'email' in person.person && typeof person.person.email === 'string') {
      return person.person.email ?? null;
    }
    return null;
  }
  return null;
};

const pickRichText = (page: PageObjectResponse, propertyName: string) => {
  const property = page.properties[propertyName];
  if (property?.type === 'rich_text') {
    return property.rich_text.map((t) => t.plain_text).join('') || null;
  }
  return null;
};

const pickDate = (page: PageObjectResponse, propertyName: string) => {
  const property = page.properties[propertyName];
  if (property?.type === 'date') {
    return property.date?.start ?? null;
  }
  return null;
};

export const mapPageToProductBacklogItem = (
  page: PageObjectResponse | PartialPageObjectResponse,
  options?: {
    titleProperty?: string;
    statusProperty?: string;
    storyPointProperty?: string;
    assigneeProperty?: string;
    epicProperty?: string;
    sprintProperty?: string;
    lastEstimatedAtProperty?: string;
  },
): ProductBacklogItem | null => {
  if (!isFullPage(page)) {
    return null;
  }

  const {
    titleProperty = 'Title',
    statusProperty = 'Status',
    storyPointProperty = 'StoryPoint',
    assigneeProperty = 'Assignee',
    epicProperty = 'Epic',
    sprintProperty = 'Sprint',
    lastEstimatedAtProperty = 'LastEstimatedAt',
  } = options ?? {};

  const rawStatus = pickSelect(page, statusProperty);
  const allowedStatuses: ProductBacklogItem['status'][] = ['Backlog', 'Ready', 'InProgress', 'Done', 'Released'];
  const status = allowedStatuses.includes(rawStatus as ProductBacklogItem['status'])
    ? (rawStatus as ProductBacklogItem['status'])
    : 'Backlog';

  return {
    id: page.id,
    title: pickTitle(page, titleProperty),
    status,
    storyPoint: pickNumber(page, storyPointProperty),
    assignee: pickPeople(page, assigneeProperty) ?? pickRichText(page, assigneeProperty),
    epic: pickSelect(page, epicProperty) ?? pickRichText(page, epicProperty),
    sprint: pickSelect(page, sprintProperty) ?? pickRichText(page, sprintProperty),
    lastEstimatedAt: pickDate(page, lastEstimatedAtProperty),
    notionUrl: page.url,
  };
};

export const extractPages = (
  response: QueryDatabaseResult,
  options?: Parameters<typeof mapPageToProductBacklogItem>[1],
) => {
  return response.results
    .map((entry) => mapPageToProductBacklogItem(entry, options))
    .filter((item): item is ProductBacklogItem => item !== null);
};
