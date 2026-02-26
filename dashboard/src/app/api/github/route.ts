import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { githubActivity } from "@/db/schema";
import { desc, sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.API_KEY}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await req.json();

    // Check if we already have a record for today
    const todayStr = new Date().toISOString().slice(0, 10);
    const existing = await db
      .select({ id: githubActivity.id, commitMessages: githubActivity.commitMessages })
      .from(githubActivity)
      .where(sql`DATE(${githubActivity.recordedAt}) = ${todayStr}`)
      .orderBy(desc(githubActivity.recordedAt))
      .limit(1);

    if (existing.length > 0 && payload.commit_messages) {
      // Merge new commits into today's existing record
      const existingCommits = (existing[0].commitMessages as any[]) || [];
      const existingShas = new Set(existingCommits.map((c: any) => c.sha));
      const newCommits = (payload.commit_messages || []).filter(
        (c: any) => !existingShas.has(c.sha)
      );
      const mergedCommits = [...existingCommits, ...newCommits];

      await db
        .update(githubActivity)
        .set({
          commitMessages: mergedCommits,
          pushEvents: payload.push_events ?? undefined,
          frustrationScore: payload.frustration_score ?? undefined,
          sentimentDetail: payload.sentiment_detail ?? undefined,
          issues: payload.issues ?? undefined,
        })
        .where(sql`${githubActivity.id} = ${existing[0].id}`);
    } else {
      // Insert new record for the day
      await db.insert(githubActivity).values({
        commitMessages: payload.commit_messages ?? null,
        pushEvents: payload.push_events ?? null,
        frustrationScore: payload.frustration_score ?? null,
        sentimentDetail: payload.sentiment_detail ?? null,
        issues: payload.issues ?? null,
      });
    }

    return NextResponse.json({ message: "GitHub activity stored", status: 200 });
  } catch (error) {
    console.error("GitHub ingest error:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}

export async function GET() {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get all records from the last 7 days
    const allData = await db
      .select()
      .from(githubActivity)
      .where(sql`${githubActivity.recordedAt} >= ${sevenDaysAgo}`)
      .orderBy(desc(githubActivity.recordedAt));

    // Collect ALL commits from all records, then filter by actual commit timestamp
    const allCommits: {
      sha: string;
      message: string;
      repo: string;
      timestamp: string;
      author?: string;
    }[] = [];
    const seenShas = new Set<string>();

    let latestFrustration = 0;
    let latestSentiment: any[] = [];
    let latestIssues: any[] = [];
    let hasSetLatest = false;

    for (const row of allData) {
      // Use the latest record's frustration/sentiment/issues
      if (!hasSetLatest) {
        latestFrustration = row.frustrationScore ?? 0;
        latestSentiment = (row.sentimentDetail as any[]) ?? [];
        latestIssues = (row.issues as any[]) ?? [];
        hasSetLatest = true;
      }

      const commits = (row.commitMessages as any[]) ?? [];
      for (const c of commits) {
        if (c.sha && !seenShas.has(c.sha)) {
          seenShas.add(c.sha);
          allCommits.push({
            sha: c.sha,
            message: c.message,
            repo: c.repo || "unknown",
            timestamp: c.timestamp,
            author: c.author,
          });
        }
      }
    }

    // Filter today's commits by the commit's actual timestamp (not record date)
    const todayCommits = allCommits.filter((c) => {
      if (!c.timestamp) return false;
      try {
        return c.timestamp.slice(0, 10) === todayStr;
      } catch {
        return false;
      }
    });

    // Filter today's sentiment entries by commit message match
    const todayMessages = new Set(todayCommits.map((c) => c.message));
    const todaySentiment = latestSentiment.filter(
      (s: any) => s.message && todayMessages.has(s.message)
    );

    // Build frustration score for today only
    const todayFrustration =
      todaySentiment.length > 0
        ? todaySentiment.reduce((sum: number, s: any) => sum + (s.score ?? 0), 0) /
        todaySentiment.length
        : latestFrustration;

    // Build repo history: ALL commits from last 7 days grouped by repo
    const repoMap: Record<
      string,
      {
        repo: string;
        totalCommits: number;
        latestDate: string;
        commits: {
          sha: string;
          message: string;
          timestamp: string;
          author?: string;
          date: string;
        }[];
      }
    > = {};

    for (const c of allCommits) {
      const commitDate = c.timestamp ? c.timestamp.slice(0, 10) : "unknown";
      const repoName = c.repo;

      if (!repoMap[repoName]) {
        repoMap[repoName] = {
          repo: repoName,
          totalCommits: 0,
          latestDate: commitDate,
          commits: [],
        };
      }

      repoMap[repoName].totalCommits++;
      if (commitDate > repoMap[repoName].latestDate) {
        repoMap[repoName].latestDate = commitDate;
      }
      repoMap[repoName].commits.push({
        sha: c.sha,
        message: c.message,
        timestamp: c.timestamp,
        author: c.author,
        date: commitDate,
      });
    }

    // Sort repos by latest activity, sort each repo's commits by date desc
    const recentRepos = Object.values(repoMap)
      .sort((a, b) => b.latestDate.localeCompare(a.latestDate))
      .map((repo) => ({
        ...repo,
        commits: repo.commits.sort((a, b) =>
          (b.timestamp ?? "").localeCompare(a.timestamp ?? "")
        ),
      }));

    return NextResponse.json({
      // Today's data only
      todayCommits,
      todayFrustration,
      todaySentiment,
      todayIssues: latestIssues,
      // Repo history: all 7 days including today
      recentRepos,
      // Legacy format for backwards compat
      entries: allData.map((d) => ({
        commitMessages: d.commitMessages,
        pushEvents: d.pushEvents,
        frustrationScore: d.frustrationScore,
        sentimentDetail: d.sentimentDetail,
        issues: d.issues,
        recordedAt: d.recordedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("GitHub query error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
