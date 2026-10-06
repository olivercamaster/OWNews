import type { Article } from './api';

let _articles: Article[] = [];

export function setArticles(articles: Article[]): void {
  _articles = articles;
}

export function getArticle(id: string): Article | null {
  return _articles.find(a => a.id === id) ?? null;
}

export function getAllArticles(): Article[] {
  return _articles;
}
