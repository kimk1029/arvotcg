export interface InfoPost {
  id: string;
  title: string;
  date: string;
  url: string;
}

export interface InfoPostsPage {
  posts: InfoPost[];
  page: number;
  hasMore: boolean;
}
