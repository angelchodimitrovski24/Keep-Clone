'use client';

import React from 'react';
import { JiraIssuesDashboard } from './JiraIssuesDashboard';

export const TeamDashboardView: React.FC = () => {
  return <JiraIssuesDashboard mode="team" />;
};
