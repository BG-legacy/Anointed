/**
 * Events & Mentorship Models Tests
 *
 * Comprehensive tests for Event, EventRsvp, Mentorship, and MentorSession models 
 * including relationships, enum constraints, unique constraints, and business logic validation.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prismaService from '../../services/prisma.js';
import { UserRepository } from '../../repositories/index.js';

describe('Events & Mentorship Models', () => {
  let prisma;
  let userRepo;
  let testUsers = [];
  let testGroups = [];
  let testEvents = [];
  let testEventRsvps = [];
  let testMentorships = [];
  let testMentorSessions = [];

  beforeAll(async () => {
    // Connect to database
    await prismaService.connect();
    prisma = prismaService.client;
    userRepo = new UserRepository();

    // Create test users
    const userDatasets = [
      {
        email: 'event-creator@example.com',
        passwordHash: 'hashedPassword123',
        displayName: 'Event Creator',
        tz: 'America/New_York',
      },
      {
        email: 'event-attendee@example.com',
        passwordHash: 'hashedPassword456',
        displayName: 'Event Attendee',
        tz: 'America/Los_Angeles',
      },
      {
        email: 'mentor-user@example.com',
        passwordHash: 'hashedPassword789',
        displayName: 'Mentor User',
        tz: 'America/Chicago',
      },
      {
        email: 'mentee-user@example.com',
        passwordHash: 'hashedPassword000',
        displayName: 'Mentee User',
        tz: 'America/Denver',
      },
      {
        email: 'group-leader@example.com',
        passwordHash: 'hashedPassword111',
        displayName: 'Group Leader',
        tz: 'America/Phoenix',
      },
    ];

    for (const userData of userDatasets) {
      const user = await userRepo.create(userData);
      testUsers.push(user);
    }

    // Create a test group for group events
    const testGroup = await prisma.group.create({
      data: {
        name: 'Event Test Group',
        description: 'Group for testing events',
        privacy: 'PUBLIC',
        createdBy: testUsers[4].id,
      },
    });
    testGroups.push(testGroup);
  });

  afterAll(async () => {
    // Clean up test data in reverse dependency order
    const cleanup = async (collection, deleteMethod) => {
      for (const item of collection) {
        try {
          await deleteMethod(item);
        } catch {
          // Ignore cleanup errors
        }
      }
    };

    await cleanup(testMentorSessions, (s) => prisma.mentorSession.delete({ where: { id: s.id } }));
    await cleanup(testMentorships, (m) => prisma.mentorship.delete({ where: { id: m.id } }));
    await cleanup(testEventRsvps, (r) => 
      prisma.eventRsvp.delete({ 
        where: { 
          eventId_userId: { 
            eventId: r.eventId, 
            userId: r.userId 
          } 
        } 
      })
    );
    await cleanup(testEvents, (e) => prisma.event.delete({ where: { id: e.id } }));
    await cleanup(testGroups, (g) => prisma.group.delete({ where: { id: g.id } }));
    await cleanup(testUsers, (u) => userRepo.hardDelete(u.id));

    // Disconnect from database
    await prismaService.disconnect();
  });

  describe('Event Model', () => {
    it('should create a public event with all fields', async () => {
      const futureDate1 = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day from now
      const futureDate2 = new Date(Date.now() + 25 * 60 * 60 * 1000); // 25 hours from now
      
      const eventData = {
        title: 'Community Bible Study',
        description: 'Weekly Bible study session for the community',
        startsAt: futureDate1,
        endsAt: futureDate2,
        location: 'Community Center Room A',
        visibility: 'PUBLIC',
        createdBy: testUsers[0].id,
      };

      const event = await prisma.event.create({
        data: eventData,
        include: {
          creator: true,
          group: true,
          rsvps: true,
          _count: {
            select: {
              rsvps: true,
            },
          },
        },
      });

      testEvents.push(event);

      expect(event).toHaveProperty('id');
      expect(event.title).toBe(eventData.title);
      expect(event.description).toBe(eventData.description);
      expect(event.startsAt).toEqual(futureDate1);
      expect(event.endsAt).toEqual(futureDate2);
      expect(event.location).toBe(eventData.location);
      expect(event.visibility).toBe('PUBLIC');
      expect(event.groupId).toBeNull();
      expect(event.createdBy).toBe(testUsers[0].id);
      expect(event.creator.email).toBe(testUsers[0].email);
      expect(event.group).toBeNull();
      expect(event.rsvps).toEqual([]);
      expect(event._count.rsvps).toBe(0);
      expect(event.createdAt).toBeInstanceOf(Date);
      expect(event.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a group event with minimal data', async () => {
      const futureDate1 = new Date(Date.now() + 48 * 60 * 60 * 1000); // 2 days from now
      const futureDate2 = new Date(Date.now() + 50 * 60 * 60 * 1000); // 50 hours from now
      
      const eventData = {
        title: 'Group Prayer Meeting',
        startsAt: futureDate1,
        endsAt: futureDate2,
        visibility: 'GROUP',
        groupId: testGroups[0].id,
        createdBy: testUsers[4].id,
      };

      const event = await prisma.event.create({
        data: eventData,
        include: {
          creator: true,
          group: true,
        },
      });

      testEvents.push(event);

      expect(event.title).toBe(eventData.title);
      expect(event.description).toBeNull();
      expect(event.location).toBeNull();
      expect(event.visibility).toBe('GROUP');
      expect(event.groupId).toBe(testGroups[0].id);
      expect(event.createdBy).toBe(testUsers[4].id);
      expect(event.group.name).toBe(testGroups[0].name);
      expect(event.creator.email).toBe(testUsers[4].email);
    });

    it('should default to PUBLIC visibility when not specified', async () => {
      const futureDate1 = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const futureDate2 = new Date(Date.now() + 74 * 60 * 60 * 1000);
      
      const eventData = {
        title: 'Default Visibility Event',
        startsAt: futureDate1,
        endsAt: futureDate2,
        createdBy: testUsers[0].id,
      };

      const event = await prisma.event.create({
        data: eventData,
      });

      testEvents.push(event);

      expect(event.visibility).toBe('PUBLIC');
    });

    it('should reject invalid visibility enum values', async () => {
      const futureDate1 = new Date(Date.now() + 96 * 60 * 60 * 1000);
      const futureDate2 = new Date(Date.now() + 98 * 60 * 60 * 1000);
      
      const eventData = {
        title: 'Invalid Visibility Event',
        startsAt: futureDate1,
        endsAt: futureDate2,
        visibility: 'INVALID_VISIBILITY',
        createdBy: testUsers[0].id,
      };

      await expect(
        prisma.event.create({ data: eventData })
      ).rejects.toThrow();
    });

    it('should update event information', async () => {
      const originalEvent = testEvents[0];
      const newFutureDate = new Date(Date.now() + 120 * 60 * 60 * 1000);
      
      const updateData = {
        title: 'Updated Bible Study',
        description: 'Updated description for the Bible study',
        location: 'New Location - Room B',
        endsAt: newFutureDate,
        visibility: 'PRIVATE',
      };

      const updatedEvent = await prisma.event.update({
        where: { id: originalEvent.id },
        data: updateData,
      });

      expect(updatedEvent.title).toBe(updateData.title);
      expect(updatedEvent.description).toBe(updateData.description);
      expect(updatedEvent.location).toBe(updateData.location);
      expect(updatedEvent.endsAt).toEqual(newFutureDate);
      expect(updatedEvent.visibility).toBe('PRIVATE');
      expect(updatedEvent.updatedAt.getTime()).toBeGreaterThan(
        originalEvent.updatedAt.getTime()
      );
    });

    it('should find events by creator', async () => {
      const creatorEvents = await prisma.event.findMany({
        where: {
          createdBy: testUsers[0].id,
        },
        include: {
          creator: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      expect(creatorEvents.length).toBeGreaterThanOrEqual(2);
      creatorEvents.forEach((event) => {
        expect(event.createdBy).toBe(testUsers[0].id);
        expect(event.creator.email).toBe(testUsers[0].email);
      });
    });

    it('should find events by visibility', async () => {
      const publicEvents = await prisma.event.findMany({
        where: { visibility: 'PUBLIC' },
      });

      const groupEvents = await prisma.event.findMany({
        where: { visibility: 'GROUP' },
      });

      const privateEvents = await prisma.event.findMany({
        where: { visibility: 'PRIVATE' },
      });

      expect(publicEvents.length).toBeGreaterThan(0);
      expect(groupEvents.length).toBeGreaterThan(0);
      expect(privateEvents.length).toBeGreaterThan(0);

      publicEvents.forEach((event) => {
        expect(event.visibility).toBe('PUBLIC');
      });
      groupEvents.forEach((event) => {
        expect(event.visibility).toBe('GROUP');
      });
      privateEvents.forEach((event) => {
        expect(event.visibility).toBe('PRIVATE');
      });
    });

    it('should find events by date range', async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const upcomingEvents = await prisma.event.findMany({
        where: {
          startsAt: {
            gte: tomorrow,
            lte: nextWeek,
          },
        },
        orderBy: { startsAt: 'asc' },
      });

      expect(upcomingEvents.length).toBeGreaterThanOrEqual(0);
      upcomingEvents.forEach((event) => {
        expect(event.startsAt.getTime()).toBeGreaterThanOrEqual(tomorrow.getTime());
        expect(event.startsAt.getTime()).toBeLessThanOrEqual(nextWeek.getTime());
      });
    });

    it('should find events by group', async () => {
      const groupEvents = await prisma.event.findMany({
        where: { groupId: testGroups[0].id },
        include: {
          group: true,
        },
      });

      expect(groupEvents.length).toBeGreaterThan(0);
      groupEvents.forEach((event) => {
        expect(event.groupId).toBe(testGroups[0].id);
        expect(event.group.name).toBe(testGroups[0].name);
      });
    });
  });

  describe('EventRsvp Model', () => {
    let testEvent;

    beforeAll(async () => {
      // Create a test event for RSVP tests
      const futureDate1 = new Date(Date.now() + 200 * 60 * 60 * 1000);
      const futureDate2 = new Date(Date.now() + 202 * 60 * 60 * 1000);
      
      testEvent = await prisma.event.create({
        data: {
          title: 'RSVP Test Event',
          description: 'Event for testing RSVPs',
          startsAt: futureDate1,
          endsAt: futureDate2,
          visibility: 'PUBLIC',
          createdBy: testUsers[0].id,
        },
      });
      testEvents.push(testEvent);
    });

    it('should create an RSVP with GOING status', async () => {
      const rsvpData = {
        eventId: testEvent.id,
        userId: testUsers[1].id,
        status: 'GOING',
      };

      const rsvp = await prisma.eventRsvp.create({
        data: rsvpData,
        include: {
          event: true,
          user: true,
        },
      });

      testEventRsvps.push(rsvp);

      expect(rsvp.eventId).toBe(testEvent.id);
      expect(rsvp.userId).toBe(testUsers[1].id);
      expect(rsvp.status).toBe('GOING');
      expect(rsvp.createdAt).toBeInstanceOf(Date);
      expect(rsvp.event.title).toBe(testEvent.title);
      expect(rsvp.user.email).toBe(testUsers[1].email);
    });

    it('should create an RSVP with INTERESTED status', async () => {
      const rsvpData = {
        eventId: testEvent.id,
        userId: testUsers[2].id,
        status: 'INTERESTED',
      };

      const rsvp = await prisma.eventRsvp.create({
        data: rsvpData,
        include: {
          event: true,
          user: true,
        },
      });

      testEventRsvps.push(rsvp);

      expect(rsvp.status).toBe('INTERESTED');
      expect(rsvp.userId).toBe(testUsers[2].id);
    });

    it('should create an RSVP with DECLINED status', async () => {
      const rsvpData = {
        eventId: testEvent.id,
        userId: testUsers[3].id,
        status: 'DECLINED',
      };

      const rsvp = await prisma.eventRsvp.create({
        data: rsvpData,
        include: {
          event: true,
          user: true,
        },
      });

      testEventRsvps.push(rsvp);

      expect(rsvp.status).toBe('DECLINED');
      expect(rsvp.userId).toBe(testUsers[3].id);
    });

    it('should enforce composite primary key (eventId, userId)', async () => {
      const duplicateRsvpData = {
        eventId: testEvent.id,
        userId: testUsers[1].id, // Already exists
        status: 'INTERESTED',
      };

      await expect(
        prisma.eventRsvp.create({ data: duplicateRsvpData })
      ).rejects.toThrow();
    });

    it('should reject invalid status enum values', async () => {
      const invalidRsvpData = {
        eventId: testEvent.id,
        userId: testUsers[4].id,
        status: 'INVALID_STATUS',
      };

      await expect(
        prisma.eventRsvp.create({ data: invalidRsvpData })
      ).rejects.toThrow();
    });

    it('should update RSVP status', async () => {
      const originalRsvp = testEventRsvps[0];

      const updatedRsvp = await prisma.eventRsvp.update({
        where: {
          eventId_userId: {
            eventId: originalRsvp.eventId,
            userId: originalRsvp.userId,
          },
        },
        data: { status: 'DECLINED' },
      });

      expect(updatedRsvp.status).toBe('DECLINED');
      expect(updatedRsvp.userId).toBe(originalRsvp.userId);
      expect(updatedRsvp.eventId).toBe(originalRsvp.eventId);
    });

    it('should find RSVPs by event', async () => {
      const eventRsvps = await prisma.eventRsvp.findMany({
        where: { eventId: testEvent.id },
        include: {
          user: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      expect(eventRsvps.length).toBe(3);
      expect(eventRsvps[0].user.email).toBe(testUsers[1].email);
      expect(eventRsvps[1].user.email).toBe(testUsers[2].email);
      expect(eventRsvps[2].user.email).toBe(testUsers[3].email);
    });

    it('should find RSVPs by status', async () => {
      const goingRsvps = await prisma.eventRsvp.findMany({
        where: {
          eventId: testEvent.id,
          status: 'GOING',
        },
        include: {
          user: true,
        },
      });

      const interestedRsvps = await prisma.eventRsvp.findMany({
        where: {
          eventId: testEvent.id,
          status: 'INTERESTED',
        },
        include: {
          user: true,
        },
      });

      const declinedRsvps = await prisma.eventRsvp.findMany({
        where: {
          eventId: testEvent.id,
          status: 'DECLINED',
        },
        include: {
          user: true,
        },
      });

      expect(goingRsvps).toHaveLength(0); // Changed to DECLINED
      expect(interestedRsvps).toHaveLength(1);
      expect(declinedRsvps).toHaveLength(2); // Original declined + updated one

      interestedRsvps.forEach((rsvp) => {
        expect(rsvp.status).toBe('INTERESTED');
      });
      declinedRsvps.forEach((rsvp) => {
        expect(rsvp.status).toBe('DECLINED');
      });
    });

    it('should find events for a user', async () => {
      const userEvents = await prisma.eventRsvp.findMany({
        where: { userId: testUsers[1].id },
        include: {
          event: {
            include: {
              creator: true,
            },
          },
        },
      });

      expect(userEvents.length).toBeGreaterThan(0);
      userEvents.forEach((rsvp) => {
        expect(rsvp.userId).toBe(testUsers[1].id);
        expect(rsvp.event).toBeTruthy();
      });
    });

    it('should count RSVPs for an event', async () => {
      const rsvpCount = await prisma.eventRsvp.count({
        where: { eventId: testEvent.id },
      });

      const goingCount = await prisma.eventRsvp.count({
        where: { 
          eventId: testEvent.id,
          status: 'GOING',
        },
      });

      expect(rsvpCount).toBe(3);
      expect(goingCount).toBe(0);
    });

    it('should handle cascade delete when event is deleted', async () => {
      // Create a temporary event and RSVP for deletion test
      const tempEvent = await prisma.event.create({
        data: {
          title: 'Temp Event for Deletion',
          startsAt: new Date(Date.now() + 300 * 60 * 60 * 1000),
          endsAt: new Date(Date.now() + 302 * 60 * 60 * 1000),
          createdBy: testUsers[0].id,
        },
      });

      const tempRsvp = await prisma.eventRsvp.create({
        data: {
          eventId: tempEvent.id,
          userId: testUsers[1].id,
          status: 'GOING',
        },
      });

      // Verify RSVP exists
      expect(
        await prisma.eventRsvp.findUnique({
          where: {
            eventId_userId: {
              eventId: tempEvent.id,
              userId: testUsers[1].id,
            },
          },
        })
      ).toBeTruthy();

      // Delete the event
      await prisma.event.delete({
        where: { id: tempEvent.id },
      });

      // Verify RSVP is also deleted (cascade)
      expect(
        await prisma.eventRsvp.findUnique({
          where: {
            eventId_userId: {
              eventId: tempEvent.id,
              userId: testUsers[1].id,
            },
          },
        })
      ).toBeNull();
    });
  });

  describe('Mentorship Model', () => {
    it('should create a mentorship with default ACTIVE status', async () => {
      const mentorshipData = {
        mentorId: testUsers[2].id,
        menteeId: testUsers[3].id,
      };

      const mentorship = await prisma.mentorship.create({
        data: mentorshipData,
        include: {
          mentor: true,
          mentee: true,
          sessions: true,
        },
      });

      testMentorships.push(mentorship);

      expect(mentorship).toHaveProperty('id');
      expect(mentorship.mentorId).toBe(testUsers[2].id);
      expect(mentorship.menteeId).toBe(testUsers[3].id);
      expect(mentorship.status).toBe('ACTIVE');
      expect(mentorship.startedAt).toBeInstanceOf(Date);
      expect(mentorship.createdAt).toBeInstanceOf(Date);
      expect(mentorship.updatedAt).toBeInstanceOf(Date);
      expect(mentorship.mentor.email).toBe(testUsers[2].email);
      expect(mentorship.mentee.email).toBe(testUsers[3].email);
      expect(mentorship.sessions).toEqual([]);
    });

    it('should create a mentorship with explicit status', async () => {
      const mentorshipData = {
        mentorId: testUsers[0].id,
        menteeId: testUsers[1].id,
        status: 'PAUSED',
      };

      const mentorship = await prisma.mentorship.create({
        data: mentorshipData,
        include: {
          mentor: true,
          mentee: true,
        },
      });

      testMentorships.push(mentorship);

      expect(mentorship.status).toBe('PAUSED');
      expect(mentorship.mentorId).toBe(testUsers[0].id);
      expect(mentorship.menteeId).toBe(testUsers[1].id);
    });

    it('should enforce unique constraint on (mentorId, menteeId)', async () => {
      const duplicateMentorshipData = {
        mentorId: testUsers[2].id, // Same mentor
        menteeId: testUsers[3].id, // Same mentee
      };

      await expect(
        prisma.mentorship.create({ data: duplicateMentorshipData })
      ).rejects.toThrow();
    });

    it('should allow different combinations of mentor/mentee pairs', async () => {
      const mentorshipData = {
        mentorId: testUsers[4].id,
        menteeId: testUsers[0].id,
        status: 'ACTIVE',
      };

      const mentorship = await prisma.mentorship.create({
        data: mentorshipData,
      });

      testMentorships.push(mentorship);

      expect(mentorship.mentorId).toBe(testUsers[4].id);
      expect(mentorship.menteeId).toBe(testUsers[0].id);
      expect(mentorship.status).toBe('ACTIVE');
    });

    it('should reject invalid status enum values', async () => {
      const invalidMentorshipData = {
        mentorId: testUsers[1].id,
        menteeId: testUsers[4].id,
        status: 'INVALID_STATUS',
      };

      await expect(
        prisma.mentorship.create({ data: invalidMentorshipData })
      ).rejects.toThrow();
    });

    it('should update mentorship status', async () => {
      const originalMentorship = testMentorships[0];

      const updatedMentorship = await prisma.mentorship.update({
        where: { id: originalMentorship.id },
        data: { status: 'COMPLETED' },
      });

      expect(updatedMentorship.status).toBe('COMPLETED');
      expect(updatedMentorship.id).toBe(originalMentorship.id);
      expect(updatedMentorship.updatedAt.getTime()).toBeGreaterThan(
        originalMentorship.updatedAt.getTime()
      );
    });

    it('should find mentorships by mentor', async () => {
      const mentorMentorships = await prisma.mentorship.findMany({
        where: { mentorId: testUsers[2].id },
        include: {
          mentee: true,
        },
      });

      expect(mentorMentorships.length).toBeGreaterThan(0);
      mentorMentorships.forEach((mentorship) => {
        expect(mentorship.mentorId).toBe(testUsers[2].id);
        expect(mentorship.mentee).toBeTruthy();
      });
    });

    it('should find mentorships by mentee', async () => {
      const menteeMentorships = await prisma.mentorship.findMany({
        where: { menteeId: testUsers[3].id },
        include: {
          mentor: true,
        },
      });

      expect(menteeMentorships.length).toBeGreaterThan(0);
      menteeMentorships.forEach((mentorship) => {
        expect(mentorship.menteeId).toBe(testUsers[3].id);
        expect(mentorship.mentor).toBeTruthy();
      });
    });

    it('should find mentorships by status', async () => {
      const activeMentorships = await prisma.mentorship.findMany({
        where: { status: 'ACTIVE' },
        include: {
          mentor: true,
          mentee: true,
        },
      });

      const completedMentorships = await prisma.mentorship.findMany({
        where: { status: 'COMPLETED' },
        include: {
          mentor: true,
          mentee: true,
        },
      });

      const pausedMentorships = await prisma.mentorship.findMany({
        where: { status: 'PAUSED' },
        include: {
          mentor: true,
          mentee: true,
        },
      });

      expect(activeMentorships.length).toBeGreaterThan(0);
      expect(completedMentorships.length).toBeGreaterThan(0);
      expect(pausedMentorships.length).toBeGreaterThan(0);

      activeMentorships.forEach((mentorship) => {
        expect(mentorship.status).toBe('ACTIVE');
      });
      completedMentorships.forEach((mentorship) => {
        expect(mentorship.status).toBe('COMPLETED');
      });
      pausedMentorships.forEach((mentorship) => {
        expect(mentorship.status).toBe('PAUSED');
      });
    });
  });

  describe('MentorSession Model', () => {
    let testMentorship;

    beforeAll(async () => {
      // Create a test mentorship for session tests
      testMentorship = await prisma.mentorship.create({
        data: {
          mentorId: testUsers[0].id,
          menteeId: testUsers[4].id,
          status: 'ACTIVE',
        },
      });
      testMentorships.push(testMentorship);
    });

    it('should create a mentor session with all fields', async () => {
      const sessionDate = new Date(Date.now() + 168 * 60 * 60 * 1000); // 1 week from now
      
      const sessionData = {
        mentorshipId: testMentorship.id,
        scheduledAt: sessionDate,
        notes: 'First mentoring session - introduction and goal setting',
      };

      const session = await prisma.mentorSession.create({
        data: sessionData,
        include: {
          mentorship: {
            include: {
              mentor: true,
              mentee: true,
            },
          },
        },
      });

      testMentorSessions.push(session);

      expect(session).toHaveProperty('id');
      expect(session.mentorshipId).toBe(testMentorship.id);
      expect(session.scheduledAt).toEqual(sessionDate);
      expect(session.notes).toBe(sessionData.notes);
      expect(session.completedAt).toBeNull();
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.updatedAt).toBeInstanceOf(Date);
      expect(session.mentorship.mentor.email).toBe(testUsers[0].email);
      expect(session.mentorship.mentee.email).toBe(testUsers[4].email);
    });

    it('should create a mentor session with minimal data', async () => {
      const sessionDate = new Date(Date.now() + 336 * 60 * 60 * 1000); // 2 weeks from now
      
      const sessionData = {
        mentorshipId: testMentorship.id,
        scheduledAt: sessionDate,
      };

      const session = await prisma.mentorSession.create({
        data: sessionData,
        include: {
          mentorship: true,
        },
      });

      testMentorSessions.push(session);

      expect(session.mentorshipId).toBe(testMentorship.id);
      expect(session.scheduledAt).toEqual(sessionDate);
      expect(session.notes).toBeNull();
      expect(session.completedAt).toBeNull();
    });

    it('should mark session as completed', async () => {
      const originalSession = testMentorSessions[0];
      const completedAt = new Date();

      const completedSession = await prisma.mentorSession.update({
        where: { id: originalSession.id },
        data: { 
          completedAt,
          notes: 'Session completed successfully. Discussed goals and next steps.',
        },
      });

      expect(completedSession.completedAt).toEqual(completedAt);
      expect(completedSession.notes).toContain('Session completed successfully');
      expect(completedSession.updatedAt.getTime()).toBeGreaterThan(
        originalSession.updatedAt.getTime()
      );
    });

    it('should find sessions by mentorship', async () => {
      const mentorshipSessions = await prisma.mentorSession.findMany({
        where: { mentorshipId: testMentorship.id },
        include: {
          mentorship: {
            include: {
              mentor: true,
              mentee: true,
            },
          },
        },
        orderBy: { scheduledAt: 'asc' },
      });

      expect(mentorshipSessions.length).toBe(2);
      mentorshipSessions.forEach((session) => {
        expect(session.mentorshipId).toBe(testMentorship.id);
        expect(session.mentorship.mentor.email).toBe(testUsers[0].email);
        expect(session.mentorship.mentee.email).toBe(testUsers[4].email);
      });
    });

    it('should find completed sessions', async () => {
      const completedSessions = await prisma.mentorSession.findMany({
        where: {
          mentorshipId: testMentorship.id,
          completedAt: {
            not: null,
          },
        },
        include: {
          mentorship: true,
        },
      });

      const upcomingSessions = await prisma.mentorSession.findMany({
        where: {
          mentorshipId: testMentorship.id,
          completedAt: null,
        },
        include: {
          mentorship: true,
        },
      });

      expect(completedSessions.length).toBe(1);
      expect(upcomingSessions.length).toBe(1);

      completedSessions.forEach((session) => {
        expect(session.completedAt).toBeTruthy();
      });
      upcomingSessions.forEach((session) => {
        expect(session.completedAt).toBeNull();
      });
    });

    it('should find sessions by date range', async () => {
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const upcomingSessions = await prisma.mentorSession.findMany({
        where: {
          scheduledAt: {
            gte: nextWeek,
            lte: nextMonth,
          },
        },
        orderBy: { scheduledAt: 'asc' },
      });

      expect(upcomingSessions.length).toBeGreaterThanOrEqual(0);
      upcomingSessions.forEach((session) => {
        expect(session.scheduledAt.getTime()).toBeGreaterThanOrEqual(nextWeek.getTime());
        expect(session.scheduledAt.getTime()).toBeLessThanOrEqual(nextMonth.getTime());
      });
    });

    it('should handle cascade delete when mentorship is deleted', async () => {
      // Create a temporary mentorship and session for deletion test
      const tempMentorship = await prisma.mentorship.create({
        data: {
          mentorId: testUsers[1].id,
          menteeId: testUsers[2].id,
          status: 'ACTIVE',
        },
      });

      const tempSession = await prisma.mentorSession.create({
        data: {
          mentorshipId: tempMentorship.id,
          scheduledAt: new Date(Date.now() + 504 * 60 * 60 * 1000), // 3 weeks from now
          notes: 'Temporary session for deletion test',
        },
      });

      // Verify session exists
      expect(
        await prisma.mentorSession.findUnique({
          where: { id: tempSession.id },
        })
      ).toBeTruthy();

      // Delete the mentorship
      await prisma.mentorship.delete({
        where: { id: tempMentorship.id },
      });

      // Verify session is also deleted (cascade)
      expect(
        await prisma.mentorSession.findUnique({
          where: { id: tempSession.id },
        })
      ).toBeNull();
    });
  });

  describe('Events & Mentorship Model Relationships', () => {
    it('should include event RSVPs count and creator in event queries', async () => {
      const eventWithDetails = await prisma.event.findFirst({
        where: { createdBy: testUsers[0].id },
        include: {
          creator: true,
          group: true,
          rsvps: {
            include: {
              user: true,
            },
          },
          _count: {
            select: {
              rsvps: true,
            },
          },
        },
      });

      expect(eventWithDetails.creator).toBeTruthy();
      expect(eventWithDetails.creator.email).toBe(testUsers[0].email);
      expect(eventWithDetails.rsvps).toBeInstanceOf(Array);
      expect(eventWithDetails._count.rsvps).toBeGreaterThanOrEqual(0);
    });

    it('should query user with their created events, RSVPs, and mentorships', async () => {
      const userWithRelations = await prisma.user.findUnique({
        where: { id: testUsers[0].id },
        include: {
          createdEvents: true,
          eventRsvps: {
            include: {
              event: true,
            },
          },
          mentorships: {
            include: {
              mentee: true,
            },
          },
          menteeships: {
            include: {
              mentor: true,
            },
          },
        },
      });

      expect(userWithRelations.createdEvents).toBeInstanceOf(Array);
      expect(userWithRelations.eventRsvps).toBeInstanceOf(Array);
      expect(userWithRelations.mentorships).toBeInstanceOf(Array);
      expect(userWithRelations.menteeships).toBeInstanceOf(Array);

      userWithRelations.createdEvents.forEach((event) => {
        expect(event.createdBy).toBe(testUsers[0].id);
      });

      userWithRelations.eventRsvps.forEach((rsvp) => {
        expect(rsvp.userId).toBe(testUsers[0].id);
        expect(rsvp.event).toBeTruthy();
      });

      userWithRelations.mentorships.forEach((mentorship) => {
        expect(mentorship.mentorId).toBe(testUsers[0].id);
        expect(mentorship.mentee).toBeTruthy();
      });

      userWithRelations.menteeships.forEach((mentorship) => {
        expect(mentorship.menteeId).toBe(testUsers[0].id);
        expect(mentorship.mentor).toBeTruthy();
      });
    });

    it('should query mentorship with session count and participants', async () => {
      const mentorshipWithDetails = await prisma.mentorship.findFirst({
        where: { 
          mentorId: testUsers[0].id,
          menteeId: testUsers[4].id,
        },
        include: {
          mentor: true,
          mentee: true,
          sessions: {
            orderBy: { scheduledAt: 'asc' },
          },
          _count: {
            select: {
              sessions: true,
            },
          },
        },
      });

      expect(mentorshipWithDetails.mentor).toBeTruthy();
      expect(mentorshipWithDetails.mentee).toBeTruthy();
      expect(mentorshipWithDetails.sessions).toBeInstanceOf(Array);
      expect(mentorshipWithDetails._count.sessions).toBeGreaterThan(0);
      expect(mentorshipWithDetails.mentor.email).toBe(testUsers[0].email);
      expect(mentorshipWithDetails.mentee.email).toBe(testUsers[4].email);
    });

    it('should query group with events', async () => {
      const groupWithEvents = await prisma.group.findUnique({
        where: { id: testGroups[0].id },
        include: {
          events: {
            include: {
              creator: true,
              _count: {
                select: {
                  rsvps: true,
                },
              },
            },
          },
          _count: {
            select: {
              events: true,
            },
          },
        },
      });

      expect(groupWithEvents.events).toBeInstanceOf(Array);
      expect(groupWithEvents._count.events).toBeGreaterThanOrEqual(0);

      groupWithEvents.events.forEach((event) => {
        expect(event.groupId).toBe(testGroups[0].id);
        expect(event.creator).toBeTruthy();
      });
    });
  });
});
