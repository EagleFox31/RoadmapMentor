import { db } from "../db";
import { eq } from "drizzle-orm";
import {
  mentoringPackages,
  mentoringPackageScopeItems,
  type MentoringPackage,
  type InsertMentoringPackage,
  type MentoringPackageScopeItem,
  type InsertMentoringPackageScopeItem,
  type MentoringPackageWithScope,
} from "@shared/schema";

export interface MentoringPackageStore {
  getMentoringPackage(id: number): Promise<MentoringPackage | undefined>;
  getMentoringPackagesByMentorship(mentorshipId: number): Promise<MentoringPackageWithScope[]>;
  createMentoringPackageWithScope(
    packageData: InsertMentoringPackage,
    scopeItems: Array<Omit<InsertMentoringPackageScopeItem, "packageId">>,
  ): Promise<MentoringPackageWithScope>;
}

export class MentoringPackageRepository implements MentoringPackageStore {
  // Mentoring package / scope methods
  async getMentoringPackage(id: number): Promise<MentoringPackage | undefined> {
    const [mentoringPackage] = await db
      .select()
      .from(mentoringPackages)
      .where(eq(mentoringPackages.id, id))
      .limit(1);
    return mentoringPackage || undefined;
  }

  async getMentoringPackagesByMentorship(
    mentorshipId: number,
  ): Promise<MentoringPackageWithScope[]> {
    const packages = await db
      .select()
      .from(mentoringPackages)
      .where(eq(mentoringPackages.mentorshipId, mentorshipId))
      .orderBy(mentoringPackages.periodStart, mentoringPackages.id);

    return await Promise.all(
      packages.map(async (mentoringPackage) => {
        const scopeItems = await db
          .select()
          .from(mentoringPackageScopeItems)
          .where(eq(mentoringPackageScopeItems.packageId, mentoringPackage.id))
          .orderBy(mentoringPackageScopeItems.id);

        return { ...mentoringPackage, scopeItems };
      }),
    );
  }

  async createMentoringPackageWithScope(
    packageData: InsertMentoringPackage,
    scopeItems: Array<Omit<InsertMentoringPackageScopeItem, "packageId">>,
  ): Promise<MentoringPackageWithScope> {
    return await db.transaction(async (tx) => {
      const [createdPackage] = await tx
        .insert(mentoringPackages)
        .values(packageData)
        .returning();

      const createdScopeItems: MentoringPackageScopeItem[] = scopeItems.length
        ? await tx
            .insert(mentoringPackageScopeItems)
            .values(
              scopeItems.map((scopeItem) => ({
                ...scopeItem,
                packageId: createdPackage.id,
              })),
            )
            .returning()
        : [];

      return {
        ...createdPackage,
        scopeItems: createdScopeItems,
      };
    });
  }
}
