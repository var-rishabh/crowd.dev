import SequelizeTestUtils from '../../database/utils/sequelizeTestUtils'
import CommunityMemberService from '../communityMemberService'
import ActivityService from '../activityService'
import CommunityMemberRepository from '../../database/repositories/communityMemberRepository'
import ActivityRepository from '../../database/repositories/activityRepository'
import ConversationService from '../conversationService'
import SequelizeRepository from '../../database/repositories/sequelizeRepository'
import SearchEngineTestUtils from '../../search-engine/utils/searchEngineTestUtils'
import { PlatformType } from '../../utils/platforms'
import SettingsRepository from '../../database/repositories/settingsRepository'
import ConversationSettingsRepository from '../../database/repositories/conversationSettingsRepository'

const db = null
const searchEngine = null

describe('ActivityService tests', () => {
  beforeEach(async () => {
    await SequelizeTestUtils.wipeDatabase(db)
  })

  afterAll(async () => {
    // Closing the DB connection allows Jest to exit successfully.
    await SequelizeTestUtils.closeConnection(db)
  })

  describe('upsert method', () => {
    it('Should create non existent activity with no parent', async () => {
      const mockIRepositoryOptions = await SequelizeTestUtils.getTestIRepositoryOptions(db)
      const memberCreated = await new CommunityMemberService(mockIRepositoryOptions).upsert({
        username: {
          crowdUsername: 'test',
          github: 'test',
        },
        platform: PlatformType.GITHUB,
        joinedAt: '2020-05-27T15:13:30Z',
      })

      const activity = {
        type: 'activity',
        timestamp: '2020-05-27T15:13:30Z',
        platform: PlatformType.GITHUB,
        crowdInfo: {
          replies: 12,
          body: 'Here',
        },
        sourceId: '#sourceId',
        isKeyAction: true,
        communityMember: memberCreated.id,
        score: 1,
      }

      const activityCreated = await new ActivityService(mockIRepositoryOptions).upsert(activity)

      // Trim the hour part from timestamp so we can atleast test if the day is correct for createdAt and joinedAt
      activityCreated.createdAt = activityCreated.createdAt.toISOString().split('T')[0]
      activityCreated.updatedAt = activityCreated.updatedAt.toISOString().split('T')[0]
      delete activityCreated.communityMember

      const expectedActivityCreated = {
        id: activityCreated.id,
        crowdInfo: activity.crowdInfo,
        type: 'activity',
        timestamp: new Date('2020-05-27T15:13:30Z'),
        platform: PlatformType.GITHUB,
        isKeyAction: true,
        score: 1,
        communityMemberId: memberCreated.id,
        createdAt: SequelizeTestUtils.getNowWithoutTime(),
        updatedAt: SequelizeTestUtils.getNowWithoutTime(),
        deletedAt: null,
        tenantId: mockIRepositoryOptions.currentTenant.id,
        createdById: mockIRepositoryOptions.currentUser.id,
        updatedById: mockIRepositoryOptions.currentUser.id,
        importHash: null,
        info: {},
        parent: null,
        parentId: null,
        conversationId: null,
        sourceId: activity.sourceId,
        sourceParentId: null,
      }

      expect(activityCreated).toStrictEqual(expectedActivityCreated)
    })

    it('Should create non existent activity with parent', async () => {
      const mockIRepositoryOptions = await SequelizeTestUtils.getTestIRepositoryOptions(db)
      const memberCreated = await new CommunityMemberService(mockIRepositoryOptions).upsert({
        username: {
          crowdUsername: 'test',
          github: 'test',
        },
        platform: PlatformType.GITHUB,
        joinedAt: '2020-05-27T15:13:30Z',
      })

      const activity1 = {
        type: 'question',
        timestamp: '2020-05-27T15:13:30Z',
        communityMember: memberCreated.id,
        platform: 'stackoverflow',
        crowdInfo: {
          body: 'What is love?',
        },
        isKeyAction: true,
        score: 1,
        sourceId: 'sourceId#1',
      }

      const activityCreated1 = await new ActivityService(mockIRepositoryOptions).upsert(activity1)

      const activity2 = {
        type: 'answer',
        timestamp: '2020-05-28T15:13:30Z',
        platform: 'stackoverflow',
        crowdInfo: {
          body: 'Baby dont hurt me',
        },
        isKeyAction: true,
        communityMember: memberCreated.id,
        score: 2,
        sourceId: 'sourceId#2',
        sourceParentId: activityCreated1.sourceId,
      }

      const activityCreated2 = await new ActivityService(mockIRepositoryOptions).upsert(activity2)

      // Since an activity with a parent is created, a Conversation entity should be created at this point
      // with both parent and the child activities. Try finding it using the slug

      const conversationCreated = await new ConversationService(
        mockIRepositoryOptions,
      ).findAndCountAll({ slug: 'what-is-love' })

      delete activityCreated2.communityMember
      delete activityCreated2.parent
      // Trim the hour part from timestamp so we can atleast test if the day is correct for createdAt and joinedAt
      activityCreated2.createdAt = activityCreated2.createdAt.toISOString().split('T')[0]
      activityCreated2.updatedAt = activityCreated2.updatedAt.toISOString().split('T')[0]

      const expectedActivityCreated = {
        id: activityCreated2.id,
        crowdInfo: activity2.crowdInfo,
        type: activity2.type,
        timestamp: new Date(activity2.timestamp),
        platform: activity2.platform,
        isKeyAction: activity2.isKeyAction,
        score: activity2.score,
        communityMemberId: memberCreated.id,
        createdAt: SequelizeTestUtils.getNowWithoutTime(),
        updatedAt: SequelizeTestUtils.getNowWithoutTime(),
        deletedAt: null,
        tenantId: mockIRepositoryOptions.currentTenant.id,
        createdById: mockIRepositoryOptions.currentUser.id,
        updatedById: mockIRepositoryOptions.currentUser.id,
        importHash: null,
        info: {},
        parentId: activityCreated1.id,
        sourceParentId: activity1.sourceId,
        sourceId: activity2.sourceId,
        conversationId: conversationCreated.rows[0].id,
      }

      expect(activityCreated2).toStrictEqual(expectedActivityCreated)
    })

    it('Should update already existing activity succesfully', async () => {
      const mockIRepositoryOptions = await SequelizeTestUtils.getTestIRepositoryOptions(db)
      const memberCreated = await new CommunityMemberService(mockIRepositoryOptions).upsert({
        username: {
          crowdUsername: 'test',
          github: 'test',
        },
        platform: PlatformType.GITHUB,
        joinedAt: '2020-05-27T15:13:30Z',
      })

      const activity1 = {
        type: 'question',
        timestamp: '2020-05-27T15:13:30Z',
        communityMember: memberCreated.id,
        platform: 'stackoverflow',
        crowdInfo: {
          question: 'What is love?',
          nested_1: {
            attribute_1: '1',
            nested_2: {
              attribute_2: '2',
              attribute_array: [1, 2, 3],
            },
          },
        },
        isKeyAction: true,
        score: 1,
        sourceId: '#sourceId1',
      }

      const activityCreated1 = await new ActivityService(mockIRepositoryOptions).upsert(activity1)

      const activity2 = {
        type: 'question',
        timestamp: '2020-05-27T15:13:30Z',
        communityMember: memberCreated.id,
        platform: 'stackoverflow',
        crowdInfo: {
          question: 'Test',
          nested_1: {
            attribute_1: '1',
            nested_2: {
              attribute_2: '5',
              attribute_3: 'test',
              attribute_array: [3, 4, 5],
            },
          },
          one: 'Baby dont hurt me',
          two: 'Dont hurt me',
          three: 'No more',
        },
        isKeyAction: false,
        score: 2,
        sourceId: '#sourceId1',
      }

      const activityUpserted = await new ActivityService(mockIRepositoryOptions).upsert(activity2)

      // Trim the hour part from timestamp so we can atleast test if the day is correct for createdAt and joinedAt
      activityUpserted.createdAt = activityUpserted.createdAt.toISOString().split('T')[0]
      activityUpserted.updatedAt = activityUpserted.updatedAt.toISOString().split('T')[0]

      // delete models before expect because we already have ids (communityMemberId, parentId)
      delete activityUpserted.communityMember
      delete activityUpserted.parent

      const crowdInfoExpected = {
        ...activity1.crowdInfo,
        ...activity2.crowdInfo,
      }

      crowdInfoExpected.nested_1.nested_2.attribute_array = [1, 2, 3, 4, 5]

      const expectedActivityCreated = {
        id: activityCreated1.id,
        crowdInfo: crowdInfoExpected,
        type: activity2.type,
        timestamp: new Date(activity2.timestamp),
        platform: activity2.platform,
        isKeyAction: activity2.isKeyAction,
        score: activity2.score,
        communityMemberId: memberCreated.id,
        createdAt: SequelizeTestUtils.getNowWithoutTime(),
        updatedAt: SequelizeTestUtils.getNowWithoutTime(),
        deletedAt: null,
        tenantId: mockIRepositoryOptions.currentTenant.id,
        createdById: mockIRepositoryOptions.currentUser.id,
        updatedById: mockIRepositoryOptions.currentUser.id,
        importHash: null,
        info: {},
        parentId: null,
        sourceParentId: null,
        sourceId: activity1.sourceId,
        conversationId: null,
      }

      expect(activityUpserted).toStrictEqual(expectedActivityCreated)
    })

    it('Should create various conversations successfully with given parent-child relationships of activities [ascending timestamp order]', async () => {
      const mockIRepositoryOptions = await SequelizeTestUtils.getTestIRepositoryOptions(db)
      const memberService = new CommunityMemberService(mockIRepositoryOptions)
      const activityService = new ActivityService(mockIRepositoryOptions)

      const member1Created = await memberService.upsert({
        username: {
          crowdUsername: 'test',
          discord: 'test',
        },
        platform: PlatformType.DISCORD,
        joinedAt: '2020-05-27T15:13:30Z',
      })
      const member2Created = await memberService.upsert({
        username: {
          crowdUsername: 'test2',
          discord: 'test2',
        },
        platform: PlatformType.DISCORD,
        joinedAt: '2020-05-27T15:13:30Z',
      })

      // Simulate a reply chain in discord

      const activity1 = {
        type: 'message',
        timestamp: '2020-05-27T15:13:30Z',
        communityMember: member1Created.id,
        platform: PlatformType.DISCORD,
        crowdInfo: {
          body: 'What is love?',
        },
        isKeyAction: true,
        score: 1,
        sourceId: 'sourceId#1',
      }

      let activityCreated1 = await activityService.upsert(activity1)

      const activity2 = {
        type: 'message',
        timestamp: '2020-05-28T15:14:30Z',
        platform: PlatformType.DISCORD,
        crowdInfo: {
          body: 'Baby dont hurt me',
        },
        isKeyAction: true,
        communityMember: member2Created.id,
        score: 2,
        sourceId: 'sourceId#2',
        sourceParentId: activityCreated1.sourceId,
      }

      const activityCreated2 = await activityService.upsert(activity2)

      const activity3 = {
        type: 'message',
        timestamp: '2020-05-28T15:15:30Z',
        platform: PlatformType.DISCORD,
        crowdInfo: {
          body: 'Dont hurt me',
        },
        isKeyAction: true,
        communityMember: member1Created.id,
        score: 2,
        sourceId: 'sourceId#3',
        sourceParentId: activityCreated2.sourceId,
      }

      const activityCreated3 = await activityService.upsert(activity3)

      const activity4 = {
        type: 'message',
        timestamp: '2020-05-28T15:16:30Z',
        platform: PlatformType.DISCORD,
        crowdInfo: {
          body: 'No more',
        },
        isKeyAction: true,
        communityMember: member2Created.id,
        score: 2,
        sourceId: 'sourceId#4',
        sourceParentId: activityCreated3.sourceId,
      }

      const activityCreated4 = await activityService.upsert(activity4)

      // Get the conversation using slug (generated using the chain starter activity crowdInfo.body)
      const conversationCreated = (
        await new ConversationService(mockIRepositoryOptions).findAndCountAll({
          slug: 'what-is-love',
        })
      ).rows[0]

      // We have to get activity1 again because conversation creation happens
      // after creation of the first activity that has a parent (activity2)
      activityCreated1 = await activityService.findById(activityCreated1.id)

      // All activities (including chain starter) should belong to the same conversation
      expect(activityCreated1.conversationId).toStrictEqual(conversationCreated.id)
      expect(activityCreated2.conversationId).toStrictEqual(conversationCreated.id)
      expect(activityCreated3.conversationId).toStrictEqual(conversationCreated.id)
      expect(activityCreated4.conversationId).toStrictEqual(conversationCreated.id)

      // Emulate a thread in discord

      const activity5 = {
        type: 'message',
        timestamp: '2020-05-28T15:17:30Z',
        platform: PlatformType.DISCORD,
        crowdInfo: {
          body: 'Never gonna give you up',
        },
        isKeyAction: true,
        communityMember: member1Created.id,
        score: 2,
        sourceId: 'sourceId#5',
      }
      let activityCreated5 = await activityService.upsert(activity5)

      const activity6 = {
        type: 'message',
        timestamp: '2020-05-28T15:18:30Z',
        platform: PlatformType.DISCORD,
        crowdInfo: {
          body: 'Never gonna let you down',
        },
        isKeyAction: true,
        communityMember: member2Created.id,
        score: 2,
        sourceId: 'sourceId#6',
        sourceParentId: activityCreated5.sourceId,
      }
      const activityCreated6 = await activityService.upsert(activity6)

      const activity7 = {
        type: 'message',
        timestamp: '2020-05-28T15:19:30Z',
        platform: PlatformType.DISCORD,
        crowdInfo: {
          body: 'Never gonna run around and desert you',
        },
        isKeyAction: true,
        communityMember: member1Created.id,
        score: 2,
        sourceId: 'sourceId#7',
        sourceParentId: activityCreated5.sourceId,
      }
      const activityCreated7 = await activityService.upsert(activity7)

      const conversationCreated2 = (
        await new ConversationService(mockIRepositoryOptions).findAndCountAll({
          slug: 'never-gonna-give-you-up',
        })
      ).rows[0]

      activityCreated5 = await activityService.findById(activityCreated5.id)

      // All activities (including thread starter) should belong to the same conversation
      expect(activityCreated5.conversationId).toStrictEqual(conversationCreated2.id)
      expect(activityCreated6.conversationId).toStrictEqual(conversationCreated2.id)
      expect(activityCreated7.conversationId).toStrictEqual(conversationCreated2.id)
    })

    it('Should create various conversations successfully with given parent-child relationships of activities [descending timestamp order]', async () => {
      const mockIRepositoryOptions = await SequelizeTestUtils.getTestIRepositoryOptions(db)
      const memberService = new CommunityMemberService(mockIRepositoryOptions)
      const activityService = new ActivityService(mockIRepositoryOptions)

      const member1Created = await memberService.upsert({
        username: {
          crowdUsername: 'test',
          discord: 'test',
        },
        platform: PlatformType.DISCORD,
        joinedAt: '2020-05-27T15:13:30Z',
      })

      const member2Created = await memberService.upsert({
        username: {
          crowdUsername: 'test2',
          discord: 'test2',
        },
        platform: PlatformType.DISCORD,
        joinedAt: '2020-05-27T15:13:30Z',
      })

      // Simulate a reply chain in discord in reverse order (child activities come first)

      const activity4 = {
        type: 'message',
        timestamp: '2020-05-28T15:16:30Z',
        platform: PlatformType.DISCORD,
        crowdInfo: {
          body: 'No more',
        },
        isKeyAction: true,
        communityMember: member2Created.id,
        score: 2,
        sourceId: 'sourceId#4',
        sourceParentId: 'sourceId#3',
      }

      let activityCreated4 = await activityService.upsert(activity4)

      const activity3 = {
        type: 'message',
        timestamp: '2020-05-28T15:15:30Z',
        platform: PlatformType.DISCORD,
        crowdInfo: {
          body: 'Dont hurt me',
        },
        isKeyAction: true,
        communityMember: member1Created.id,
        score: 2,
        sourceId: 'sourceId#3',
        sourceParentId: 'sourceId#2',
      }

      let activityCreated3 = await activityService.upsert(activity3)

      const activity2 = {
        type: 'message',
        timestamp: '2020-05-28T15:14:30Z',
        platform: PlatformType.DISCORD,
        crowdInfo: {
          body: 'Baby dont hurt me',
        },
        isKeyAction: true,
        communityMember: member2Created.id,
        score: 2,
        sourceId: 'sourceId#2',
        sourceParentId: 'sourceId#1',
      }

      let activityCreated2 = await activityService.upsert(activity2)

      const activity1 = {
        type: 'message',
        timestamp: '2020-05-27T15:13:30Z',
        communityMember: member1Created.id,
        platform: PlatformType.DISCORD,
        crowdInfo: {
          body: 'What is love?',
        },
        isKeyAction: true,
        score: 1,
        sourceId: 'sourceId#1',
      }

      // main parent activity that starts the reply chain
      let activityCreated1 = await activityService.upsert(activity1)

      // get activities again
      activityCreated1 = await activityService.findById(activityCreated1.id)
      activityCreated2 = await activityService.findById(activityCreated2.id)
      activityCreated3 = await activityService.findById(activityCreated3.id)
      activityCreated4 = await activityService.findById(activityCreated4.id)

      // expect parentIds
      expect(activityCreated4.parentId).toBe(activityCreated3.id)
      expect(activityCreated3.parentId).toBe(activityCreated2.id)
      expect(activityCreated2.parentId).toBe(activityCreated1.id)

      // Get the conversation using slug (generated using the chain starter activity crowdInfo.body -last added activityCreated1-)
      const conversationCreated = (
        await new ConversationService(mockIRepositoryOptions).findAndCountAll({
          slug: 'what-is-love',
        })
      ).rows[0]

      // All activities (including chain starter) should belong to the same conversation
      expect(activityCreated1.conversationId).toStrictEqual(conversationCreated.id)
      expect(activityCreated2.conversationId).toStrictEqual(conversationCreated.id)
      expect(activityCreated3.conversationId).toStrictEqual(conversationCreated.id)
      expect(activityCreated4.conversationId).toStrictEqual(conversationCreated.id)

      // Simulate a thread in reverse order

      const activity6 = {
        type: 'message',
        timestamp: '2020-05-28T15:18:30Z',
        platform: PlatformType.DISCORD,
        crowdInfo: {
          body: 'Never gonna let you down',
        },
        isKeyAction: true,
        communityMember: member2Created.id,
        score: 2,
        sourceId: 'sourceId#6',
        sourceParentId: 'sourceId#5',
      }
      let activityCreated6 = await activityService.upsert(activity6)

      const activity7 = {
        type: 'message',
        timestamp: '2020-05-28T15:19:30Z',
        platform: PlatformType.DISCORD,
        crowdInfo: {
          body: 'Never gonna run around and desert you',
        },
        isKeyAction: true,
        communityMember: member1Created.id,
        score: 2,
        sourceId: 'sourceId#7',
        sourceParentId: 'sourceId#5',
      }
      let activityCreated7 = await activityService.upsert(activity7)

      const activity5 = {
        type: 'message',
        timestamp: '2020-05-28T15:17:30Z',
        platform: PlatformType.DISCORD,
        crowdInfo: {
          body: 'Never gonna give you up',
        },
        isKeyAction: true,
        communityMember: member1Created.id,
        score: 2,
        sourceId: 'sourceId#5',
      }
      let activityCreated5 = await activityService.upsert(activity5)

      const conversationCreated2 = (
        await new ConversationService(mockIRepositoryOptions).findAndCountAll({
          slug: 'never-gonna-give-you-up',
        })
      ).rows[0]

      // get activities again
      activityCreated5 = await activityService.findById(activityCreated5.id)
      activityCreated6 = await activityService.findById(activityCreated6.id)
      activityCreated7 = await activityService.findById(activityCreated7.id)

      // expect parentIds
      expect(activityCreated6.parentId).toBe(activityCreated5.id)
      expect(activityCreated7.parentId).toBe(activityCreated5.id)

      expect(activityCreated5.conversationId).toStrictEqual(conversationCreated2.id)
      expect(activityCreated6.conversationId).toStrictEqual(conversationCreated2.id)
      expect(activityCreated7.conversationId).toStrictEqual(conversationCreated2.id)

      // Add some more childs to the conversation1 and conversation2
      // After setting child-parent in reverse order, we're now adding
      // some more childiren in normal order

      // add a new reply to the chain-starter activity
      const activity8 = {
        type: 'message',
        timestamp: '2020-05-28T15:21:30Z',
        platform: PlatformType.DISCORD,
        crowdInfo: {
          body: 'additional reply to the reply chain',
        },
        isKeyAction: true,
        communityMember: member2Created.id,
        score: 2,
        sourceId: 'sourceId#8',
        sourceParentId: 'sourceId#1',
      }

      const activityCreated8 = await activityService.upsert(activity8)

      expect(activityCreated8.parentId).toBe(activityCreated1.id)
      expect(activityCreated8.conversationId).toStrictEqual(conversationCreated.id)

      // add a new activity to the thread
      const activity9 = {
        type: 'message',
        timestamp: '2020-05-28T15:35:30Z',
        platform: PlatformType.DISCORD,
        crowdInfo: {
          body: 'additional message to the thread',
        },
        isKeyAction: true,
        communityMember: member2Created.id,
        score: 2,
        sourceId: 'sourceId#9',
        sourceParentId: 'sourceId#5',
      }

      const activityCreated9 = await activityService.upsert(activity9)

      expect(activityCreated9.parentId).toBe(activityCreated5.id)
      expect(activityCreated9.conversationId).toStrictEqual(conversationCreated2.id)
    })
  })

  describe('createWithMember method', () => {
    it('Create an activity with given member [no parent activity]', async () => {
      const mockIRepositoryOptions = await SequelizeTestUtils.getTestIRepositoryOptions(db)

      const communityMember = {
        username: {
          crowdUsername: 'anil',
          github: 'anil_github',
        },
        email: 'lala@l.com',
        score: 10,
        crowdInfo: {
          github: {
            name: 'Quoc-Anh Nguyen',
            isHireable: true,
            url: 'https://github.com/imcvampire',
            websiteUrl: 'https://imcvampire.js.org/',
            bio: 'Lazy geek',
            location: 'Helsinki, Finland',
            actions: [
              {
                score: 2,
                timestamp: '2021-05-27T15:13:30Z',
              },
            ],
          },
          twitter: {
            profile_url: 'https://twitter.com/imcvampire',
            url: 'https://twitter.com/imcvampire',
          },
        },
        bio: 'Computer Science',
        organisation: 'Crowd',
        location: 'Istanbul',
        signals: 'testSignal',
        joinedAt: '2020-05-27T15:13:30Z',
      }

      const data = {
        communityMember,
        crowdInfo: {
          body: 'Description\nThis pull request adds a new Dashboard and related widgets. This work will probably have to be revisited as soon as possible since a lot of decisions were made, without having too much time to think about different outcomes/possibilities. We rushed these changes so that we can demo a working dashboard to YC and to our Investors.\nChanges Proposed\n\nUpdate Chart.js\nAdd two different type of widgets (number and graph)\nRemove older/default widgets from dashboard and add our own widgets\nHide some items from the menu\nAdd all widget infrastructure (actions, services, etc) to integrate with the backend\nAdd a few more CSS tweaks\n\nScreenshots',
          title: 'Dashboard widgets and some other tweaks/adjustments',
          state: 'merged',
          url: 'https://github.com/CrowdDevHQ/crowd-web/pull/16',
          repo: 'https://github.com/CrowdDevHQ/crowd-web',
        },
        timestamp: '2021-09-30T14:20:27.000Z',
        type: 'pull_request-closed',
        isKeyAction: true,
        platform: PlatformType.GITHUB,
        score: 4,
        info: {},
        sourceId: '#sourceId1',
      }

      const activityWithMember = await new ActivityService(mockIRepositoryOptions).createWithMember(
        data,
      )

      delete activityWithMember.communityMember

      activityWithMember.createdAt = activityWithMember.createdAt.toISOString().split('T')[0]
      activityWithMember.updatedAt = activityWithMember.updatedAt.toISOString().split('T')[0]

      const member = await CommunityMemberRepository.findById(
        activityWithMember.communityMemberId,
        mockIRepositoryOptions,
      )

      const expectedActivityCreated = {
        id: activityWithMember.id,
        crowdInfo: data.crowdInfo,
        type: data.type,
        timestamp: new Date(data.timestamp),
        platform: data.platform,
        isKeyAction: data.isKeyAction,
        score: data.score,
        communityMemberId: member.id,
        createdAt: SequelizeTestUtils.getNowWithoutTime(),
        updatedAt: SequelizeTestUtils.getNowWithoutTime(),
        deletedAt: null,
        tenantId: mockIRepositoryOptions.currentTenant.id,
        createdById: mockIRepositoryOptions.currentUser.id,
        updatedById: mockIRepositoryOptions.currentUser.id,
        importHash: null,
        info: {},
        parentId: null,
        parent: null,
        sourceParentId: null,
        sourceId: data.sourceId,
        conversationId: null,
      }

      expect(activityWithMember).toStrictEqual(expectedActivityCreated)
    })

    it('Create an activity with given member [with parent activity, upsert member, new activity] [parent first, child later]', async () => {
      const mockIRepositoryOptions = await SequelizeTestUtils.getTestIRepositoryOptions(db)

      const communityMember = {
        username: 'anil_github',
        email: 'lala@l.com',
        score: 10,
        crowdInfo: {
          github: {
            name: 'Quoc-Anh Nguyen',
            isHireable: true,
            url: 'https://github.com/imcvampire',
            websiteUrl: 'https://imcvampire.js.org/',
            bio: 'Lazy geek',
            location: 'Helsinki, Finland',
            actions: [
              {
                score: 2,
                timestamp: '2021-05-27T15:13:30Z',
              },
            ],
          },
          twitter: {
            profile_url: 'https://twitter.com/imcvampire',
            url: 'https://twitter.com/imcvampire',
          },
        },
        bio: 'Computer Science',
        organisation: 'Crowd',
        location: 'Istanbul',
        signals: 'testSignal',
        joinedAt: '2020-05-27T15:13:30Z',
      }

      const data = {
        communityMember,
        crowdInfo: {
          body: 'Description\nThis pull request adds a new Dashboard and related widgets. This work will probably have to be revisited as soon as possible since a lot of decisions were made, without having too much time to think about different outcomes/possibilities. We rushed these changes so that we can demo a working dashboard to YC and to our Investors.\nChanges Proposed\n\nUpdate Chart.js\nAdd two different type of widgets (number and graph)\nRemove older/default widgets from dashboard and add our own widgets\nHide some items from the menu\nAdd all widget infrastructure (actions, services, etc) to integrate with the backend\nAdd a few more CSS tweaks\n\nScreenshots',
          title: 'Dashboard widgets and some other tweaks/adjustments',
          state: 'merged',
          url: 'https://github.com/CrowdDevHQ/crowd-web/pull/16',
          repo: 'https://github.com/CrowdDevHQ/crowd-web',
        },
        timestamp: '2021-09-30T14:20:27.000Z',
        type: 'pull_request-closed',
        isKeyAction: true,
        platform: PlatformType.GITHUB,
        score: 4,
        info: {},
        sourceId: '#sourceId1',
      }

      const activityWithMember1 = await new ActivityService(
        mockIRepositoryOptions,
      ).createWithMember(data)

      const data2 = {
        communityMember,
        crowdInfo: {
          body: 'Description\nMinor pull request that fixes the order by Score and # of activities in the members list page',
          title: 'Add order by score and # of activities',
          state: 'merged',
          url: 'https://github.com/CrowdDevHQ/crowd-web/pull/30',
          repo: 'https://github.com/CrowdDevHQ/crowd-web',
        },
        timestamp: '2021-11-30T14:20:27.000Z',
        type: 'pull_request-open',
        isKeyAction: true,
        platform: PlatformType.GITHUB,
        score: 4,
        info: {},
        sourceId: '#sourceId2',
        sourceParentId: data.sourceId,
      }

      const activityWithMember2 = await new ActivityService(
        mockIRepositoryOptions,
      ).createWithMember(data2)

      // Since an activity with a parent is created, a Conversation entity should be created at this point
      // with both parent and the child activities. Try finding it using the slug (slug is generated using parent.crowdInfo.body)

      const conversationCreated = await new ConversationService(
        mockIRepositoryOptions,
      ).findAndCountAll({ slug: 'description-this-pull-request-adds-a-new-dashboard-and-related' })

      // delete models before expect because we already have ids (communityMemberId, parentId)
      delete activityWithMember2.communityMember
      delete activityWithMember2.parent

      activityWithMember2.createdAt = activityWithMember2.createdAt.toISOString().split('T')[0]
      activityWithMember2.updatedAt = activityWithMember2.updatedAt.toISOString().split('T')[0]

      const member = await CommunityMemberRepository.findById(
        activityWithMember1.communityMemberId,
        mockIRepositoryOptions,
      )

      const expectedActivityCreated = {
        id: activityWithMember2.id,
        crowdInfo: data2.crowdInfo,
        type: data2.type,
        timestamp: new Date(data2.timestamp),
        platform: data2.platform,
        isKeyAction: data2.isKeyAction,
        score: data2.score,
        communityMemberId: member.id,
        createdAt: SequelizeTestUtils.getNowWithoutTime(),
        updatedAt: SequelizeTestUtils.getNowWithoutTime(),
        deletedAt: null,
        tenantId: mockIRepositoryOptions.currentTenant.id,
        createdById: mockIRepositoryOptions.currentUser.id,
        updatedById: mockIRepositoryOptions.currentUser.id,
        importHash: null,
        info: {},
        parentId: activityWithMember1.id,
        sourceParentId: data2.sourceParentId,
        sourceId: data2.sourceId,
        conversationId: conversationCreated.rows[0].id,
      }

      expect(activityWithMember2).toStrictEqual(expectedActivityCreated)
    })

    it('Create an activity with given member [with parent activity, upsert member, new activity] [child first, parent later]', async () => {
      const mockIRepositoryOptions = await SequelizeTestUtils.getTestIRepositoryOptions(db)
      const activityService = new ActivityService(mockIRepositoryOptions)

      const communityMember = {
        username: 'anil_github',
        email: 'lala@l.com',
        score: 10,
        crowdInfo: {
          github: {
            name: 'Quoc-Anh Nguyen',
            isHireable: true,
            url: 'https://github.com/imcvampire',
            websiteUrl: 'https://imcvampire.js.org/',
            bio: 'Lazy geek',
            location: 'Helsinki, Finland',
            actions: [
              {
                score: 2,
                timestamp: '2021-05-27T15:13:30Z',
              },
            ],
          },
          twitter: {
            profile_url: 'https://twitter.com/imcvampire',
            url: 'https://twitter.com/imcvampire',
          },
        },
        bio: 'Computer Science',
        organisation: 'Crowd',
        location: 'Istanbul',
        signals: 'testSignal',
        joinedAt: '2020-05-27T15:13:30Z',
      }

      const dataChild = {
        communityMember,
        crowdInfo: {
          body: 'Description\nMinor pull request that fixes the order by Score and # of activities in the members list page',
          title: 'Add order by score and # of activities',
          state: 'merged',
          url: 'https://github.com/CrowdDevHQ/crowd-web/pull/30',
          repo: 'https://github.com/CrowdDevHQ/crowd-web',
        },
        timestamp: '2021-11-30T14:20:27.000Z',
        type: 'pull_request-open',
        isKeyAction: true,
        platform: PlatformType.GITHUB,
        score: 4,
        info: {},
        sourceParentId: '#sourceId1',
        sourceId: '#childSourceId',
      }

      let activityWithMemberChild = await activityService.createWithMember(dataChild)

      const dataParent = {
        communityMember,
        crowdInfo: {
          body: 'Description\nThis pull request adds a new Dashboard and related widgets. This work will probably have to be revisited as soon as possible since a lot of decisions were made, without having too much time to think about different outcomes/possibilities. We rushed these changes so that we can demo a working dashboard to YC and to our Investors.\nChanges Proposed\n\nUpdate Chart.js\nAdd two different type of widgets (number and graph)\nRemove older/default widgets from dashboard and add our own widgets\nHide some items from the menu\nAdd all widget infrastructure (actions, services, etc) to integrate with the backend\nAdd a few more CSS tweaks\n\nScreenshots',
          title: 'Dashboard widgets and some other tweaks/adjustments',
          state: 'merged',
          url: 'https://github.com/CrowdDevHQ/crowd-web/pull/16',
          repo: 'https://github.com/CrowdDevHQ/crowd-web',
        },
        timestamp: '2021-09-30T14:20:27.000Z',
        type: 'pull_request-closed',
        isKeyAction: true,
        platform: PlatformType.GITHUB,
        score: 4,
        info: {},
        sourceId: dataChild.sourceParentId,
      }

      let activityWithMemberParent = await activityService.createWithMember(dataParent)

      // after creating parent, conversation should be started
      const conversationCreated = await new ConversationService(
        mockIRepositoryOptions,
      ).findAndCountAll({ slug: 'description-this-pull-request-adds-a-new-dashboard-and-related' })

      // get child and parent activity again
      activityWithMemberChild = await activityService.findById(activityWithMemberChild.id)
      activityWithMemberParent = await activityService.findById(activityWithMemberParent.id)

      // delete models before expect because we already have ids (communityMemberId, parentId)
      delete activityWithMemberChild.communityMember
      delete activityWithMemberChild.parent
      delete activityWithMemberParent.communityMember
      delete activityWithMemberParent.parent

      activityWithMemberChild.createdAt = activityWithMemberChild.createdAt
        .toISOString()
        .split('T')[0]
      activityWithMemberChild.updatedAt = activityWithMemberChild.updatedAt
        .toISOString()
        .split('T')[0]
      activityWithMemberParent.createdAt = activityWithMemberParent.createdAt
        .toISOString()
        .split('T')[0]
      activityWithMemberParent.updatedAt = activityWithMemberParent.updatedAt
        .toISOString()
        .split('T')[0]

      const member = await CommunityMemberRepository.findById(
        activityWithMemberChild.communityMemberId,
        mockIRepositoryOptions,
      )

      const expectedParentActivityCreated = {
        id: activityWithMemberParent.id,
        crowdInfo: dataParent.crowdInfo,
        type: dataParent.type,
        timestamp: new Date(dataParent.timestamp),
        platform: dataParent.platform,
        isKeyAction: dataParent.isKeyAction,
        score: dataParent.score,
        communityMemberId: member.id,
        createdAt: SequelizeTestUtils.getNowWithoutTime(),
        updatedAt: SequelizeTestUtils.getNowWithoutTime(),
        deletedAt: null,
        tenantId: mockIRepositoryOptions.currentTenant.id,
        createdById: mockIRepositoryOptions.currentUser.id,
        updatedById: mockIRepositoryOptions.currentUser.id,
        importHash: null,
        info: {},
        parentId: null,
        sourceParentId: null,
        sourceId: dataParent.sourceId,
        conversationId: conversationCreated.rows[0].id,
      }

      expect(activityWithMemberParent).toStrictEqual(expectedParentActivityCreated)

      const expectedChildActivityCreated = {
        id: activityWithMemberChild.id,
        crowdInfo: dataChild.crowdInfo,
        type: dataChild.type,
        timestamp: new Date(dataChild.timestamp),
        platform: dataChild.platform,
        isKeyAction: dataChild.isKeyAction,
        score: dataChild.score,
        communityMemberId: member.id,
        createdAt: SequelizeTestUtils.getNowWithoutTime(),
        updatedAt: SequelizeTestUtils.getNowWithoutTime(),
        deletedAt: null,
        tenantId: mockIRepositoryOptions.currentTenant.id,
        createdById: mockIRepositoryOptions.currentUser.id,
        updatedById: mockIRepositoryOptions.currentUser.id,
        importHash: null,
        info: {},
        parentId: activityWithMemberParent.id,
        sourceParentId: dataChild.sourceParentId,
        sourceId: dataChild.sourceId,
        conversationId: conversationCreated.rows[0].id,
      }

      expect(activityWithMemberChild).toStrictEqual(expectedChildActivityCreated)
    })

    it('Create an activity with given member [no parent activity, upsert member, upsert activity]', async () => {
      const mockIRepositoryOptions = await SequelizeTestUtils.getTestIRepositoryOptions(db)

      const communityMember = {
        username: 'anil_github',
        email: 'lala@l.com',
        score: 10,
        crowdInfo: {
          github: {
            name: 'Quoc-Anh Nguyen',
            isHireable: true,
            url: 'https://github.com/imcvampire',
            websiteUrl: 'https://imcvampire.js.org/',
            bio: 'Lazy geek',
            location: 'Helsinki, Finland',
            actions: [
              {
                score: 2,
                timestamp: '2021-05-27T15:13:30Z',
              },
            ],
          },
          twitter: {
            profile_url: 'https://twitter.com/imcvampire',
            url: 'https://twitter.com/imcvampire',
          },
        },
        bio: 'Computer Science',
        organisation: 'Crowd',
        location: 'Istanbul',
        signals: 'testSignal',
        joinedAt: '2020-05-27T15:13:30Z',
      }

      const data = {
        communityMember,
        crowdInfo: {
          body: 'Description\nThis pull request adds a new Dashboard and related widgets. This work will probably have to be revisited as soon as possible since a lot of decisions were made, without having too much time to think about different outcomes/possibilities. We rushed these changes so that we can demo a working dashboard to YC and to our Investors.\nChanges Proposed\n\nUpdate Chart.js\nAdd two different type of widgets (number and graph)\nRemove older/default widgets from dashboard and add our own widgets\nHide some items from the menu\nAdd all widget infrastructure (actions, services, etc) to integrate with the backend\nAdd a few more CSS tweaks\n\nScreenshots',
          title: 'Dashboard widgets and some other tweaks/adjustments',
          state: 'merged',
          url: 'https://github.com/CrowdDevHQ/crowd-web/pull/16',
          repo: 'https://github.com/CrowdDevHQ/crowd-web',
          newTestField: 'test',
        },
        timestamp: '2021-09-30T14:20:27.000Z',
        type: 'pull_request-closed',
        isKeyAction: true,
        platform: PlatformType.GITHUB,
        score: 4,
        info: {},
        sourceId: '#sourceId1',
      }

      const activityWithMember1 = await new ActivityService(
        mockIRepositoryOptions,
      ).createWithMember(data)

      const data2 = {
        communityMember: {
          username: communityMember.username,
          platform: data.platform,
          crowdInfo: { githubNewField: { body: 'test' } },
        },
        crowdInfo: {
          body: 'Description\nMinor pull request that fixes the order by Score and # of activities in the members list page',
          title: 'Add order by score and # of activities',
          state: 'merged',
          url: 'https://github.com/CrowdDevHQ/crowd-web/pull/30',
          repo: 'https://github.com/CrowdDevHQ/crowd-web',
        },
        timestamp: '2021-09-30T14:20:27.000Z',
        type: 'pull_request-closed',
        isKeyAction: true,
        platform: PlatformType.GITHUB,
        score: 4,
        info: {},
        sourceId: '#sourceId1',
        // sourceParentId: data.sourceId,
      }

      const activityWithMember2 = await new ActivityService(
        mockIRepositoryOptions,
      ).createWithMember(data2)

      // get the first created activity. Second call to createWithMember should be updating this
      const upsertedActivity = await ActivityRepository.findById(
        activityWithMember1.id,
        mockIRepositoryOptions,
      )

      // get the first created member. Second call to createWithMember should be updating this object
      const member = await CommunityMemberRepository.findById(
        activityWithMember1.communityMemberId,
        mockIRepositoryOptions,
      )

      // delete models before expect because we already have ids (communityMemberId, parentId)
      delete upsertedActivity.communityMember
      delete upsertedActivity.parent

      upsertedActivity.createdAt = upsertedActivity.createdAt.toISOString().split('T')[0]
      upsertedActivity.updatedAt = upsertedActivity.updatedAt.toISOString().split('T')[0]

      const expectedActivityCreated = {
        id: activityWithMember2.id,
        crowdInfo: {
          ...data.crowdInfo,
          ...data2.crowdInfo,
        },
        type: data2.type,
        timestamp: new Date(data2.timestamp),
        platform: data2.platform,
        isKeyAction: data2.isKeyAction,
        score: data2.score,
        communityMemberId: member.id,
        createdAt: SequelizeTestUtils.getNowWithoutTime(),
        updatedAt: SequelizeTestUtils.getNowWithoutTime(),
        deletedAt: null,
        tenantId: mockIRepositoryOptions.currentTenant.id,
        createdById: mockIRepositoryOptions.currentUser.id,
        updatedById: mockIRepositoryOptions.currentUser.id,
        importHash: null,
        info: {},
        parentId: null,
        sourceId: data.sourceId,
        sourceParentId: null,
        conversationId: null,
      }

      expect(upsertedActivity).toStrictEqual(expectedActivityCreated)
    })

    it('Upsert activity. Member with different username, but same activity (member changed username)', async () => {
      const mockIRepositoryOptions = await SequelizeTestUtils.getTestIRepositoryOptions(db)

      const communityMember = {
        username: 'anil_github',
        email: 'lala@l.com',
        score: 10,
        crowdInfo: {
          github: {
            name: 'Quoc-Anh Nguyen',
            isHireable: true,
            url: 'https://github.com/imcvampire',
            websiteUrl: 'https://imcvampire.js.org/',
            bio: 'Lazy geek',
            location: 'Helsinki, Finland',
            actions: [
              {
                score: 2,
                timestamp: '2021-05-27T15:13:30Z',
              },
            ],
          },
          twitter: {
            profile_url: 'https://twitter.com/imcvampire',
            url: 'https://twitter.com/imcvampire',
          },
        },
        bio: 'Computer Science',
        organisation: 'Crowd',
        location: 'Istanbul',
        signals: 'testSignal',
        joinedAt: '2020-05-27T15:13:30Z',
      }

      const data = {
        communityMember,
        crowdInfo: {
          body: 'Description\nThis pull request adds a new Dashboard and related widgets. This work will probably have to be revisited as soon as possible since a lot of decisions were made, without having too much time to think about different outcomes/possibilities. We rushed these changes so that we can demo a working dashboard to YC and to our Investors.\nChanges Proposed\n\nUpdate Chart.js\nAdd two different type of widgets (number and graph)\nRemove older/default widgets from dashboard and add our own widgets\nHide some items from the menu\nAdd all widget infrastructure (actions, services, etc) to integrate with the backend\nAdd a few more CSS tweaks\n\nScreenshots',
          title: 'Dashboard widgets and some other tweaks/adjustments',
          state: 'merged',
          url: 'https://github.com/CrowdDevHQ/crowd-web/pull/16',
          repo: 'https://github.com/CrowdDevHQ/crowd-web',
          newTestField: 'test',
        },
        timestamp: '2021-09-30T14:20:27.000Z',
        type: 'pull_request-closed',
        isKeyAction: true,
        platform: PlatformType.GITHUB,
        score: 4,
        info: {},
        sourceId: '#sourceId1',
      }

      const activityWithMember1 = await new ActivityService(
        mockIRepositoryOptions,
      ).createWithMember(data)

      // This is the same activity. However, the member has changed username
      const data2 = {
        communityMember: {
          username: 'different_username',
          platform: data.platform,
          crowdInfo: { githubNewField: { body: 'test' } },
        },
        crowdInfo: {
          body: 'Description\nMinor pull request that fixes the order by Score and # of activities in the members list page',
          title: 'Add order by score and # of activities',
          state: 'merged',
          url: 'https://github.com/CrowdDevHQ/crowd-web/pull/30',
          repo: 'https://github.com/CrowdDevHQ/crowd-web',
        },
        timestamp: data.timestamp,
        type: data.type,
        isKeyAction: true,
        platform: data.platform,
        score: 4,
        info: {},
        sourceId: '#sourceId1',
      }

      await new ActivityService(mockIRepositoryOptions).createWithMember(data2)

      await ActivityRepository.findById(activityWithMember1.id, mockIRepositoryOptions)

      const members = await CommunityMemberRepository.findAndCountAll(
        { filter: {} },
        mockIRepositoryOptions,
      )

      const activities = await ActivityRepository.findAndCountAll(
        { filter: {} },
        mockIRepositoryOptions,
      )

      expect(members.count).toBe(1)
      expect(activities.count).toBe(1)

      const member = members.rows[0]
      expect(member.username).toStrictEqual({
        github: 'different_username',
        crowdUsername: 'anil_github',
      })

      // // delete models before expect because we already have ids (communityMemberId, parentId)
      // delete upsertedActivity.communityMember
      // delete upsertedActivity.parent

      // upsertedActivity.createdAt = upsertedActivity.createdAt.toISOString().split('T')[0]
      // upsertedActivity.updatedAt = upsertedActivity.updatedAt.toISOString().split('T')[0]

      // const expectedActivityCreated = {
      //   id: activityWithMember2.id,
      //   crowdInfo: {
      //     ...data.crowdInfo,
      //     ...data2.crowdInfo,
      //   },
      //   type: data2.type,
      //   timestamp: new Date(data2.timestamp),
      //   platform: data2.platform,
      //   isKeyAction: data2.isKeyAction,
      //   score: data2.score,
      //   communityMemberId: member.id,
      //   createdAt: SequelizeTestUtils.getNowWithoutTime(),
      //   updatedAt: SequelizeTestUtils.getNowWithoutTime(),
      //   deletedAt: null,
      //   tenantId: mockIRepositoryOptions.currentTenant.id,
      //   createdById: mockIRepositoryOptions.currentUser.id,
      //   updatedById: mockIRepositoryOptions.currentUser.id,
      //   importHash: null,
      //   info: {},
      //   parentId: activityWithMember1.id,
      //   sourceId: data.sourceId,
      // }

      // expect(upsertedActivity).toStrictEqual(expectedActivityCreated)
    })

    describe('Community member tests in createWithMember', () => {
      it('Should set the joinedAt to the time of the activity when the member does not exist', async () => {
        const mockIRepositoryOptions = await SequelizeTestUtils.getTestIRepositoryOptions(db)

        const communityMember = {
          username: {
            crowdUsername: 'anil',
            github: 'anil_github',
          },
          email: 'lala@l.com',
          score: 10,
          crowdInfo: {
            github: {
              name: 'Quoc-Anh Nguyen',
              isHireable: true,
              url: 'https://github.com/imcvampire',
              websiteUrl: 'https://imcvampire.js.org/',
              bio: 'Lazy geek',
              location: 'Helsinki, Finland',
              actions: [
                {
                  score: 2,
                  timestamp: '2021-05-27T15:13:30Z',
                },
              ],
            },
            twitter: {
              profile_url: 'https://twitter.com/imcvampire',
              url: 'https://twitter.com/imcvampire',
            },
          },
          bio: 'Computer Science',
          organisation: 'Crowd',
          location: 'Istanbul',
          signals: 'testSignal',
          joinedAt: '2020-05-27T15:13:30Z',
        }

        const data = {
          communityMember,
          crowdInfo: {
            body: 'Description\nThis pull request adds a new Dashboard and related widgets. This work will probably have to be revisited as soon as possible since a lot of decisions were made, without having too much time to think about different outcomes/possibilities. We rushed these changes so that we can demo a working dashboard to YC and to our Investors.\nChanges Proposed\n\nUpdate Chart.js\nAdd two different type of widgets (number and graph)\nRemove older/default widgets from dashboard and add our own widgets\nHide some items from the menu\nAdd all widget infrastructure (actions, services, etc) to integrate with the backend\nAdd a few more CSS tweaks\n\nScreenshots',
            title: 'Dashboard widgets and some other tweaks/adjustments',
            state: 'merged',
            url: 'https://github.com/CrowdDevHQ/crowd-web/pull/16',
            repo: 'https://github.com/CrowdDevHQ/crowd-web',
          },
          timestamp: '2021-09-30T14:20:27.000Z',
          type: 'pull_request-closed',
          isKeyAction: true,
          platform: PlatformType.GITHUB,
          score: 4,
          info: {},
          sourceId: '#sourceId1',
        }

        const activityWithMember = await new ActivityService(
          mockIRepositoryOptions,
        ).createWithMember(data)

        delete activityWithMember.communityMember

        activityWithMember.createdAt = activityWithMember.createdAt.toISOString().split('T')[0]
        activityWithMember.updatedAt = activityWithMember.updatedAt.toISOString().split('T')[0]

        const member = await CommunityMemberRepository.findById(
          activityWithMember.communityMemberId,
          mockIRepositoryOptions,
        )

        const expectedActivityCreated = {
          id: activityWithMember.id,
          crowdInfo: data.crowdInfo,
          type: data.type,
          timestamp: new Date(data.timestamp),
          platform: data.platform,
          isKeyAction: data.isKeyAction,
          score: data.score,
          communityMemberId: member.id,
          createdAt: SequelizeTestUtils.getNowWithoutTime(),
          updatedAt: SequelizeTestUtils.getNowWithoutTime(),
          deletedAt: null,
          tenantId: mockIRepositoryOptions.currentTenant.id,
          createdById: mockIRepositoryOptions.currentUser.id,
          updatedById: mockIRepositoryOptions.currentUser.id,
          importHash: null,
          info: {},
          parentId: null,
          parent: null,
          sourceParentId: null,
          sourceId: data.sourceId,
          conversationId: null,
        }

        expect(activityWithMember).toStrictEqual(expectedActivityCreated)
        expect(member.joinedAt).toStrictEqual(expectedActivityCreated.timestamp)
        expect(member.username).toStrictEqual({
          crowdUsername: 'anil',
          github: 'anil_github',
        })
      })

      it('Should replace joinedAt when activity ts is earlier than existing joinedAt', async () => {
        const mockIRepositoryOptions = await SequelizeTestUtils.getTestIRepositoryOptions(db)

        const communityMember = {
          username: {
            crowdUsername: 'anil',
            github: 'anil_github',
          },
          email: 'lala@l.com',
          score: 10,
          crowdInfo: {
            github: {
              name: 'Quoc-Anh Nguyen',
              isHireable: true,
              url: 'https://github.com/imcvampire',
              websiteUrl: 'https://imcvampire.js.org/',
              bio: 'Lazy geek',
              location: 'Helsinki, Finland',
              actions: [
                {
                  score: 2,
                  timestamp: '2021-05-27T15:13:30Z',
                },
              ],
            },
            twitter: {
              profile_url: 'https://twitter.com/imcvampire',
              url: 'https://twitter.com/imcvampire',
            },
          },
          bio: 'Computer Science',
          organisation: 'Crowd',
          location: 'Istanbul',
          signals: 'testSignal',
          joinedAt: '2022-05-27T15:13:30Z',
        }

        await CommunityMemberRepository.create(communityMember, mockIRepositoryOptions)

        const data = {
          communityMember,
          crowdInfo: {
            body: 'Description\nThis pull request adds a new Dashboard and related widgets. This work will probably have to be revisited as soon as possible since a lot of decisions were made, without having too much time to think about different outcomes/possibilities. We rushed these changes so that we can demo a working dashboard to YC and to our Investors.\nChanges Proposed\n\nUpdate Chart.js\nAdd two different type of widgets (number and graph)\nRemove older/default widgets from dashboard and add our own widgets\nHide some items from the menu\nAdd all widget infrastructure (actions, services, etc) to integrate with the backend\nAdd a few more CSS tweaks\n\nScreenshots',
            title: 'Dashboard widgets and some other tweaks/adjustments',
            state: 'merged',
            url: 'https://github.com/CrowdDevHQ/crowd-web/pull/16',
            repo: 'https://github.com/CrowdDevHQ/crowd-web',
          },
          timestamp: '2021-09-30T14:20:27.000Z',
          type: 'pull_request-closed',
          isKeyAction: true,
          platform: PlatformType.GITHUB,
          score: 4,
          info: {},
          sourceId: '#sourceId1',
        }

        const activityWithMember = await new ActivityService(
          mockIRepositoryOptions,
        ).createWithMember(data)

        delete activityWithMember.communityMember

        activityWithMember.createdAt = activityWithMember.createdAt.toISOString().split('T')[0]
        activityWithMember.updatedAt = activityWithMember.updatedAt.toISOString().split('T')[0]

        const member = await CommunityMemberRepository.findById(
          activityWithMember.communityMemberId,
          mockIRepositoryOptions,
        )

        const expectedActivityCreated = {
          id: activityWithMember.id,
          crowdInfo: data.crowdInfo,
          type: data.type,
          timestamp: new Date(data.timestamp),
          platform: data.platform,
          isKeyAction: data.isKeyAction,
          score: data.score,
          communityMemberId: member.id,
          createdAt: SequelizeTestUtils.getNowWithoutTime(),
          updatedAt: SequelizeTestUtils.getNowWithoutTime(),
          deletedAt: null,
          tenantId: mockIRepositoryOptions.currentTenant.id,
          createdById: mockIRepositoryOptions.currentUser.id,
          updatedById: mockIRepositoryOptions.currentUser.id,
          importHash: null,
          info: {},
          parentId: null,
          parent: null,
          sourceId: data.sourceId,
          sourceParentId: null,
          conversationId: null,
        }

        expect(activityWithMember).toStrictEqual(expectedActivityCreated)
        expect(member.joinedAt).toStrictEqual(expectedActivityCreated.timestamp)
        expect(member.username).toStrictEqual({
          crowdUsername: 'anil',
          github: 'anil_github',
        })
      })

      it('Should not replace joinedAt when activity ts is later than existing joinedAt', async () => {
        const mockIRepositoryOptions = await SequelizeTestUtils.getTestIRepositoryOptions(db)

        const communityMember = {
          username: {
            crowdUsername: 'anil',
            github: 'anil_github',
          },
          email: 'lala@l.com',
          score: 10,
          crowdInfo: {
            github: {
              name: 'Quoc-Anh Nguyen',
              isHireable: true,
              url: 'https://github.com/imcvampire',
              websiteUrl: 'https://imcvampire.js.org/',
              bio: 'Lazy geek',
              location: 'Helsinki, Finland',
              actions: [
                {
                  score: 2,
                  timestamp: '2021-05-27T15:13:30Z',
                },
              ],
            },
            twitter: {
              profile_url: 'https://twitter.com/imcvampire',
              url: 'https://twitter.com/imcvampire',
            },
          },
          bio: 'Computer Science',
          organisation: 'Crowd',
          location: 'Istanbul',
          signals: 'testSignal',
          joinedAt: '2020-05-27T15:13:30Z',
        }

        await CommunityMemberRepository.create(communityMember, mockIRepositoryOptions)

        const data = {
          communityMember,
          crowdInfo: {
            body: 'Description\nThis pull request adds a new Dashboard and related widgets. This work will probably have to be revisited as soon as possible since a lot of decisions were made, without having too much time to think about different outcomes/possibilities. We rushed these changes so that we can demo a working dashboard to YC and to our Investors.\nChanges Proposed\n\nUpdate Chart.js\nAdd two different type of widgets (number and graph)\nRemove older/default widgets from dashboard and add our own widgets\nHide some items from the menu\nAdd all widget infrastructure (actions, services, etc) to integrate with the backend\nAdd a few more CSS tweaks\n\nScreenshots',
            title: 'Dashboard widgets and some other tweaks/adjustments',
            state: 'merged',
            url: 'https://github.com/CrowdDevHQ/crowd-web/pull/16',
            repo: 'https://github.com/CrowdDevHQ/crowd-web',
          },
          timestamp: '2021-09-30T14:20:27.000Z',
          type: 'pull_request-closed',
          isKeyAction: true,
          platform: PlatformType.GITHUB,
          score: 4,
          info: {},
          sourceId: '#sourceId1',
        }

        const activityWithMember = await new ActivityService(
          mockIRepositoryOptions,
        ).createWithMember(data)

        delete activityWithMember.communityMember

        activityWithMember.createdAt = activityWithMember.createdAt.toISOString().split('T')[0]
        activityWithMember.updatedAt = activityWithMember.updatedAt.toISOString().split('T')[0]

        const member = await CommunityMemberRepository.findById(
          activityWithMember.communityMemberId,
          mockIRepositoryOptions,
        )

        const expectedActivityCreated = {
          id: activityWithMember.id,
          crowdInfo: data.crowdInfo,
          type: data.type,
          timestamp: new Date(data.timestamp),
          platform: data.platform,
          isKeyAction: data.isKeyAction,
          score: data.score,
          communityMemberId: member.id,
          createdAt: SequelizeTestUtils.getNowWithoutTime(),
          updatedAt: SequelizeTestUtils.getNowWithoutTime(),
          deletedAt: null,
          tenantId: mockIRepositoryOptions.currentTenant.id,
          createdById: mockIRepositoryOptions.currentUser.id,
          updatedById: mockIRepositoryOptions.currentUser.id,
          importHash: null,
          info: {},
          parentId: null,
          parent: null,
          sourceId: data.sourceId,
          sourceParentId: null,
          conversationId: null,
        }

        expect(activityWithMember).toStrictEqual(expectedActivityCreated)
        expect(member.joinedAt).toStrictEqual(new Date('2020-05-27T15:13:30Z'))
        expect(member.username).toStrictEqual({
          crowdUsername: 'anil',
          github: 'anil_github',
        })
      })

      it('It should replace joinedAt if the orginal was in year 1000', async () => {
        const mockIRepositoryOptions = await SequelizeTestUtils.getTestIRepositoryOptions(db)

        const communityMember = {
          username: {
            crowdUsername: 'anil',
            github: 'anil_github',
          },
          email: 'lala@l.com',
          score: 10,
          crowdInfo: {
            github: {
              name: 'Quoc-Anh Nguyen',
              isHireable: true,
              url: 'https://github.com/imcvampire',
              websiteUrl: 'https://imcvampire.js.org/',
              bio: 'Lazy geek',
              location: 'Helsinki, Finland',
              actions: [
                {
                  score: 2,
                  timestamp: '2021-05-27T15:13:30Z',
                },
              ],
            },
            twitter: {
              profile_url: 'https://twitter.com/imcvampire',
              url: 'https://twitter.com/imcvampire',
            },
          },
          bio: 'Computer Science',
          organisation: 'Crowd',
          location: 'Istanbul',
          signals: 'testSignal',
          joinedAt: new Date('1000-01-01T00:00:00Z'),
        }

        await CommunityMemberRepository.create(communityMember, mockIRepositoryOptions)

        const data = {
          communityMember,
          crowdInfo: {
            body: 'Description\nThis pull request adds a new Dashboard and related widgets. This work will probably have to be revisited as soon as possible since a lot of decisions were made, without having too much time to think about different outcomes/possibilities. We rushed these changes so that we can demo a working dashboard to YC and to our Investors.\nChanges Proposed\n\nUpdate Chart.js\nAdd two different type of widgets (number and graph)\nRemove older/default widgets from dashboard and add our own widgets\nHide some items from the menu\nAdd all widget infrastructure (actions, services, etc) to integrate with the backend\nAdd a few more CSS tweaks\n\nScreenshots',
            title: 'Dashboard widgets and some other tweaks/adjustments',
            state: 'merged',
            url: 'https://github.com/CrowdDevHQ/crowd-web/pull/16',
            repo: 'https://github.com/CrowdDevHQ/crowd-web',
          },
          timestamp: '2021-09-30T14:20:27.000Z',
          type: 'pull_request-closed',
          isKeyAction: true,
          platform: PlatformType.GITHUB,
          score: 4,
          info: {},
          sourceId: '#sourceId1',
        }

        const activityWithMember = await new ActivityService(
          mockIRepositoryOptions,
        ).createWithMember(data)

        delete activityWithMember.communityMember

        activityWithMember.createdAt = activityWithMember.createdAt.toISOString().split('T')[0]
        activityWithMember.updatedAt = activityWithMember.updatedAt.toISOString().split('T')[0]

        const member = await CommunityMemberRepository.findById(
          activityWithMember.communityMemberId,
          mockIRepositoryOptions,
        )

        const expectedActivityCreated = {
          id: activityWithMember.id,
          crowdInfo: data.crowdInfo,
          type: data.type,
          timestamp: new Date(data.timestamp),
          platform: data.platform,
          isKeyAction: data.isKeyAction,
          score: data.score,
          communityMemberId: member.id,
          createdAt: SequelizeTestUtils.getNowWithoutTime(),
          updatedAt: SequelizeTestUtils.getNowWithoutTime(),
          deletedAt: null,
          tenantId: mockIRepositoryOptions.currentTenant.id,
          createdById: mockIRepositoryOptions.currentUser.id,
          updatedById: mockIRepositoryOptions.currentUser.id,
          importHash: null,
          info: {},
          parentId: null,
          parent: null,
          sourceId: data.sourceId,
          sourceParentId: null,
          conversationId: null,
        }

        expect(activityWithMember).toStrictEqual(expectedActivityCreated)
        expect(member.joinedAt).toStrictEqual(expectedActivityCreated.timestamp)
        expect(member.username).toStrictEqual({
          crowdUsername: 'anil',
          github: 'anil_github',
        })
      })
    })
  })

  describe('addToConversation method', () => {
    it('Should create a new conversation and add the activities in, when parent and child has no conversation', async () => {
      const mockIRepositoryOptions = await SequelizeTestUtils.getTestIRepositoryOptions(db)
      const activityService = new ActivityService(mockIRepositoryOptions)

      const memberCreated = await new CommunityMemberService(mockIRepositoryOptions).upsert({
        username: {
          crowdUsername: 'test',
          github: 'test',
        },
        platform: PlatformType.GITHUB,
        joinedAt: '2020-05-27T15:13:30Z',
      })

      const activityParent = {
        type: 'activity',
        timestamp: '2020-05-27T14:13:30Z',
        platform: PlatformType.GITHUB,
        crowdInfo: {
          replies: 12,
          body: 'Some Parent Activity',
          repo: 'https://github.com/CrowdDevHQ/crowd-web',
        },
        isKeyAction: true,
        communityMember: memberCreated.id,
        score: 1,
        sourceId: '#sourceId1',
      }

      let activityParentCreated = await ActivityRepository.create(
        activityParent,
        mockIRepositoryOptions,
      )

      const activityChild = {
        type: 'activity',
        timestamp: '2020-05-27T15:13:30Z',
        platform: PlatformType.GITHUB,
        crowdInfo: {
          replies: 12,
          body: 'Here',
          repo: 'https://github.com/CrowdDevHQ/crowd-web',
        },
        isKeyAction: true,
        communityMember: memberCreated.id,
        score: 1,
        parent: activityParentCreated.id,
        sourceId: '#sourceId2',
      }

      let activityChildCreated = await ActivityRepository.create(
        activityChild,
        mockIRepositoryOptions,
      )

      const transaction = await SequelizeRepository.createTransaction(
        mockIRepositoryOptions.database,
      )

      await activityService.addToConversation(
        activityChildCreated.id,
        activityParentCreated.id,
        transaction,
      )

      await SequelizeRepository.commitTransaction(transaction)

      const conversationCreated = (
        await new ConversationService(mockIRepositoryOptions).findAndCountAll({
          slug: 'some-parent-activity',
        })
      ).rows[0]

      // get activities again
      activityChildCreated = await activityService.findById(activityChildCreated.id)
      activityParentCreated = await activityService.findById(activityParentCreated.id)

      // activities should belong to the newly created conversation
      expect(activityChildCreated.conversationId).toBe(conversationCreated.id)
      expect(activityParentCreated.conversationId).toBe(conversationCreated.id)
    })

    it('Should add the child activity to parents conversation, when parent already has a conversation', async () => {
      const mockIRepositoryOptions = await SequelizeTestUtils.getTestIRepositoryOptions(db)
      const activityService = new ActivityService(mockIRepositoryOptions)
      const conversationService = new ConversationService(mockIRepositoryOptions)

      const memberCreated = await new CommunityMemberService(mockIRepositoryOptions).upsert({
        username: {
          crowdUsername: 'test',
          github: 'test',
        },
        platform: PlatformType.GITHUB,
        joinedAt: '2020-05-27T15:13:30Z',
      })

      const conversation = await conversationService.create({
        slug: 'some-slug',
        title: 'some title',
      })

      const activityParent = {
        type: 'activity',
        timestamp: '2020-05-27T14:13:30Z',
        platform: PlatformType.GITHUB,
        crowdInfo: {
          replies: 12,
          body: 'Some Parent Activity',
          repo: 'https://github.com/CrowdDevHQ/crowd-web',
        },
        isKeyAction: true,
        communityMember: memberCreated.id,
        score: 1,
        conversationId: conversation.id,
        sourceId: '#sourceId1',
      }

      const activityParentCreated = await ActivityRepository.create(
        activityParent,
        mockIRepositoryOptions,
      )

      const activityChild = {
        type: 'activity',
        timestamp: '2020-05-27T15:13:30Z',
        platform: PlatformType.GITHUB,
        crowdInfo: {
          replies: 12,
          body: 'Here',
          repo: 'https://github.com/CrowdDevHQ/crowd-web',
        },
        isKeyAction: true,
        communityMember: memberCreated.id,
        score: 1,
        parent: activityParentCreated.id,
        sourceId: '#sourceId2',
      }

      let activityChildCreated = await ActivityRepository.create(
        activityChild,
        mockIRepositoryOptions,
      )

      const transaction = await SequelizeRepository.createTransaction(
        mockIRepositoryOptions.database,
      )

      await activityService.addToConversation(
        activityChildCreated.id,
        activityParentCreated.id,
        transaction,
      )

      await SequelizeRepository.commitTransaction(transaction)

      // get child activity again
      activityChildCreated = await activityService.findById(activityChildCreated.id)

      // child should be added to already existing conservation
      expect(activityChildCreated.conversationId).toBe(conversation.id)
      expect(activityParentCreated.conversationId).toBe(conversation.id)
    })

    it('Should add the parent activity to childs conversation and update conversation [published=false] title&slug, when child already has a conversation', async () => {
      const mockIRepositoryOptions = await SequelizeTestUtils.getTestIRepositoryOptions(db)
      const activityService = new ActivityService(mockIRepositoryOptions)
      const conversationService = new ConversationService(mockIRepositoryOptions)

      const memberCreated = await new CommunityMemberService(mockIRepositoryOptions).upsert({
        username: {
          crowdUsername: 'test',
          github: 'test',
        },
        platform: PlatformType.GITHUB,
        joinedAt: '2020-05-27T15:13:30Z',
      })

      let conversation = await conversationService.create({
        slug: 'some-slug',
        title: 'some title',
      })

      const activityParent = {
        type: 'activity',
        timestamp: '2020-05-27T14:13:30Z',
        platform: PlatformType.GITHUB,
        crowdInfo: {
          replies: 12,
          body: 'Some Parent Activity',
          repo: 'https://github.com/CrowdDevHQ/crowd-web',
        },
        isKeyAction: true,
        communityMember: memberCreated.id,
        score: 1,
        sourceId: '#sourceId1',
      }

      let activityParentCreated = await ActivityRepository.create(
        activityParent,
        mockIRepositoryOptions,
      )

      const activityChild = {
        type: 'activity',
        timestamp: '2020-05-27T15:13:30Z',
        platform: PlatformType.GITHUB,
        crowdInfo: {
          replies: 12,
          body: 'Here',
        },
        isKeyAction: true,
        communityMember: memberCreated.id,
        score: 1,
        parent: activityParentCreated.id,
        conversationId: conversation.id,
        sourceId: '#sourceId2',
      }

      const activityChildCreated = await ActivityRepository.create(
        activityChild,
        mockIRepositoryOptions,
      )

      const transaction = await SequelizeRepository.createTransaction(
        mockIRepositoryOptions.database,
      )

      await activityService.addToConversation(
        activityChildCreated.id,
        activityParentCreated.id,
        transaction,
      )

      await SequelizeRepository.commitTransaction(transaction)

      // get the conversation again
      conversation = await conversationService.findById(conversation.id)

      // conversation should be updated with newly added parents body
      expect(conversation.title).toBe('Some Parent Activity')
      expect(conversation.slug).toBe('some-parent-activity')

      // get parent activity again
      activityParentCreated = await activityService.findById(activityParentCreated.id)

      // parent should be added to the conversation
      expect(activityChildCreated.conversationId).toBe(conversation.id)
      expect(activityParentCreated.conversationId).toBe(conversation.id)
    })

    it('Should add the parent activity to childs conversation and NOT update conversation [published=true] title&slug, when child already has a conversation', async () => {
      let mockIRepositoryOptions = await SequelizeTestUtils.getTestIRepositoryOptions(db)
      mockIRepositoryOptions = await SearchEngineTestUtils.injectSearchEngine(
        searchEngine,
        mockIRepositoryOptions,
      )
      const activityService = new ActivityService(mockIRepositoryOptions)
      const conversationService = new ConversationService(mockIRepositoryOptions)

      const memberCreated = await new CommunityMemberService(mockIRepositoryOptions).upsert({
        username: {
          crowdUsername: 'test',
          github: 'test',
        },
        platform: PlatformType.GITHUB,
        joinedAt: '2020-05-27T15:13:30Z',
      })

      let conversation = await conversationService.create({
        slug: 'some-slug',
        title: 'some title',
        published: true,
      })

      const activityParent = {
        type: 'activity',
        timestamp: '2020-05-27T14:13:30Z',
        platform: PlatformType.GITHUB,
        crowdInfo: {
          replies: 12,
          body: 'Some Parent Activity',
          repo: 'https://github.com/CrowdDevHQ/crowd-web',
        },
        isKeyAction: true,
        communityMember: memberCreated.id,
        score: 1,
        sourceId: '#sourceId1',
      }

      let activityParentCreated = await ActivityRepository.create(
        activityParent,
        mockIRepositoryOptions,
      )

      const activityChild = {
        type: 'activity',
        timestamp: '2020-05-27T15:13:30Z',
        platform: PlatformType.GITHUB,
        crowdInfo: {
          replies: 12,
          body: 'Here',
          repo: 'https://github.com/CrowdDevHQ/crowd-web',
        },
        isKeyAction: true,
        communityMember: memberCreated.id,
        score: 1,
        parent: activityParentCreated.id,
        conversationId: conversation.id,
        sourceId: '#sourceId2',
      }

      const activityChildCreated = await ActivityRepository.create(
        activityChild,
        mockIRepositoryOptions,
      )

      const transaction = await SequelizeRepository.createTransaction(
        mockIRepositoryOptions.database,
      )

      await activityService.addToConversation(
        activityChildCreated.id,
        activityParentCreated.id,
        transaction,
      )

      await SequelizeRepository.commitTransaction(transaction)

      // get the conversation again
      conversation = await conversationService.findById(conversation.id)

      // conversation fields should NOT be updated because it's already published
      expect(conversation.title).toBe('some title')
      expect(conversation.slug).toBe('some-slug')

      // get parent activity again
      activityParentCreated = await activityService.findById(activityParentCreated.id)

      // parent should be added to the conversation
      expect(activityChildCreated.conversationId).toBe(conversation.id)
      expect(activityParentCreated.conversationId).toBe(conversation.id)
    })

    it('Should always auto-publish when conversationSettings.autoPublish.status is set to all', async () => {
      let mockIRepositoryOptions = await SequelizeTestUtils.getTestIRepositoryOptions(db)
      mockIRepositoryOptions = await SearchEngineTestUtils.injectSearchEngine(
        searchEngine,
        mockIRepositoryOptions,
      )
      const activityService = new ActivityService(mockIRepositoryOptions)
      await SettingsRepository.findOrCreateDefault(
        { website: 'https://some-website' },
        mockIRepositoryOptions,
      )
      await ConversationSettingsRepository.findOrCreateDefault(
        {
          autoPublish: {
            status: 'all',
          },
        },
        mockIRepositoryOptions,
      )

      const memberCreated = await new CommunityMemberService(mockIRepositoryOptions).upsert({
        username: {
          crowdUsername: 'test',
          github: 'test',
        },
        platform: PlatformType.GITHUB,
        joinedAt: '2020-05-27T15:13:30Z',
      })

      const activityParent = {
        type: 'activity',
        timestamp: '2020-05-27T14:13:30Z',
        platform: PlatformType.GITHUB,
        crowdInfo: {
          replies: 12,
          body: 'Some Parent Activity',
          repo: 'https://github.com/CrowdDevHQ/crowd-web',
        },
        isKeyAction: true,
        communityMember: memberCreated.id,
        score: 1,
        sourceId: '#sourceId1',
      }

      let activityParentCreated = await ActivityRepository.create(
        activityParent,
        mockIRepositoryOptions,
      )

      const activityChild = {
        type: 'activity',
        timestamp: '2020-05-27T15:13:30Z',
        platform: PlatformType.GITHUB,
        crowdInfo: {
          replies: 12,
          body: 'Here',
          repo: 'https://github.com/CrowdDevHQ/crowd-web',
        },
        isKeyAction: true,
        communityMember: memberCreated.id,
        score: 1,
        parent: activityParentCreated.id,
        sourceId: '#sourceId2',
      }

      let activityChildCreated = await ActivityRepository.create(
        activityChild,
        mockIRepositoryOptions,
      )

      const transaction = await SequelizeRepository.createTransaction(
        mockIRepositoryOptions.database,
      )

      await activityService.addToConversation(
        activityChildCreated.id,
        activityParentCreated.id,
        transaction,
      )

      const conversationCreated = (
        await new ConversationService(mockIRepositoryOptions).findAndCountAll({
          slug: 'some-parent-activity',
        })
      ).rows[0]

      await SequelizeRepository.commitTransaction(transaction)

      // get activities again
      activityChildCreated = await activityService.findById(activityChildCreated.id)
      activityParentCreated = await activityService.findById(activityParentCreated.id)

      // activities should belong to the newly created conversation
      expect(activityChildCreated.conversationId).toBe(conversationCreated.id)
      expect(activityParentCreated.conversationId).toBe(conversationCreated.id)

      expect(conversationCreated.published).toStrictEqual(true)
    })

    it('Should never auto-publish when conversationSettings.autoPublish.status is set to disabled', async () => {
      let mockIRepositoryOptions = await SequelizeTestUtils.getTestIRepositoryOptions(db)
      mockIRepositoryOptions = await SearchEngineTestUtils.injectSearchEngine(
        searchEngine,
        mockIRepositoryOptions,
      )
      const activityService = new ActivityService(mockIRepositoryOptions)
      await SettingsRepository.findOrCreateDefault(
        { website: 'https://some-website' },
        mockIRepositoryOptions,
      )
      await ConversationSettingsRepository.findOrCreateDefault(
        {
          autoPublish: {
            status: 'disabled',
          },
        },
        mockIRepositoryOptions,
      )

      const memberCreated = await new CommunityMemberService(mockIRepositoryOptions).upsert({
        username: {
          crowdUsername: 'test',
          github: 'test',
        },
        platform: PlatformType.GITHUB,
        joinedAt: '2020-05-27T15:13:30Z',
      })

      const activityParent = {
        type: 'activity',
        timestamp: '2020-05-27T14:13:30Z',
        platform: PlatformType.GITHUB,
        crowdInfo: {
          replies: 12,
          body: 'Some Parent Activity',
          repo: 'https://github.com/CrowdDevHQ/crowd-web',
        },
        isKeyAction: true,
        communityMember: memberCreated.id,
        score: 1,
        sourceId: '#sourceId1',
      }

      let activityParentCreated = await ActivityRepository.create(
        activityParent,
        mockIRepositoryOptions,
      )

      const activityChild = {
        type: 'activity',
        timestamp: '2020-05-27T15:13:30Z',
        platform: PlatformType.GITHUB,
        crowdInfo: {
          replies: 12,
          body: 'Here',
          repo: 'https://github.com/CrowdDevHQ/crowd-web',
        },
        isKeyAction: true,
        communityMember: memberCreated.id,
        score: 1,
        parent: activityParentCreated.id,
        sourceId: '#sourceId2',
      }

      let activityChildCreated = await ActivityRepository.create(
        activityChild,
        mockIRepositoryOptions,
      )

      const transaction = await SequelizeRepository.createTransaction(
        mockIRepositoryOptions.database,
      )

      await activityService.addToConversation(
        activityChildCreated.id,
        activityParentCreated.id,
        transaction,
      )

      const conversationCreated = (
        await new ConversationService(mockIRepositoryOptions).findAndCountAll({
          slug: 'some-parent-activity',
        })
      ).rows[0]

      await SequelizeRepository.commitTransaction(transaction)

      // get activities again
      activityChildCreated = await activityService.findById(activityChildCreated.id)
      activityParentCreated = await activityService.findById(activityParentCreated.id)

      // activities should belong to the newly created conversation
      expect(activityChildCreated.conversationId).toBe(conversationCreated.id)
      expect(activityParentCreated.conversationId).toBe(conversationCreated.id)

      expect(conversationCreated.published).toStrictEqual(false)
    })

    it('Should auto-publish when conversationSettings.autoPublish.status is set to custom and rules match', async () => {
      let mockIRepositoryOptions = await SequelizeTestUtils.getTestIRepositoryOptions(db)
      mockIRepositoryOptions = await SearchEngineTestUtils.injectSearchEngine(
        searchEngine,
        mockIRepositoryOptions,
      )
      const activityService = new ActivityService(mockIRepositoryOptions)
      await SettingsRepository.findOrCreateDefault(
        { website: 'https://some-website' },
        mockIRepositoryOptions,
      )
      await ConversationSettingsRepository.findOrCreateDefault(
        {
          autoPublish: {
            status: 'custom',
            channelsByPlatform: {
              github: ['crowd-web'],
            },
          },
        },
        mockIRepositoryOptions,
      )

      const memberCreated = await new CommunityMemberService(mockIRepositoryOptions).upsert({
        username: {
          crowdUsername: 'test',
          github: 'test',
        },
        platform: PlatformType.GITHUB,
        joinedAt: '2020-05-27T15:13:30Z',
      })

      const activityParent = {
        type: 'activity',
        timestamp: '2020-05-27T14:13:30Z',
        platform: PlatformType.GITHUB,
        crowdInfo: {
          replies: 12,
          body: 'Some Parent Activity',
          repo: 'https://github.com/CrowdDevHQ/crowd-web',
        },
        isKeyAction: true,
        communityMember: memberCreated.id,
        score: 1,
        sourceId: '#sourceId1',
      }

      let activityParentCreated = await ActivityRepository.create(
        activityParent,
        mockIRepositoryOptions,
      )

      const activityChild = {
        type: 'activity',
        timestamp: '2020-05-27T15:13:30Z',
        platform: PlatformType.GITHUB,
        crowdInfo: {
          replies: 12,
          body: 'Here',
          repo: 'https://github.com/CrowdDevHQ/crowd-web',
        },
        isKeyAction: true,
        communityMember: memberCreated.id,
        score: 1,
        parent: activityParentCreated.id,
        sourceId: '#sourceId2',
      }

      let activityChildCreated = await ActivityRepository.create(
        activityChild,
        mockIRepositoryOptions,
      )

      const transaction = await SequelizeRepository.createTransaction(
        mockIRepositoryOptions.database,
      )

      await activityService.addToConversation(
        activityChildCreated.id,
        activityParentCreated.id,
        transaction,
      )

      const conversationCreated = (
        await new ConversationService(mockIRepositoryOptions).findAndCountAll({
          slug: 'some-parent-activity',
        })
      ).rows[0]

      await SequelizeRepository.commitTransaction(transaction)

      // get activities again
      activityChildCreated = await activityService.findById(activityChildCreated.id)
      activityParentCreated = await activityService.findById(activityParentCreated.id)

      // activities should belong to the newly created conversation
      expect(activityChildCreated.conversationId).toBe(conversationCreated.id)
      expect(activityParentCreated.conversationId).toBe(conversationCreated.id)

      expect(conversationCreated.published).toStrictEqual(true)
    })

    it("Should not auto-publish when conversationSettings.autoPublish.status is set to custom and rules don't match", async () => {
      let mockIRepositoryOptions = await SequelizeTestUtils.getTestIRepositoryOptions(db)
      mockIRepositoryOptions = await SearchEngineTestUtils.injectSearchEngine(
        searchEngine,
        mockIRepositoryOptions,
      )
      const activityService = new ActivityService(mockIRepositoryOptions)
      await SettingsRepository.findOrCreateDefault(
        { website: 'https://some-website' },
        mockIRepositoryOptions,
      )
      await ConversationSettingsRepository.findOrCreateDefault(
        {
          autoPublish: {
            status: 'custom',
            channelsByPlatform: {
              github: ['a-different-test-repo'],
            },
          },
        },
        mockIRepositoryOptions,
      )

      const memberCreated = await new CommunityMemberService(mockIRepositoryOptions).upsert({
        username: {
          crowdUsername: 'test',
          github: 'test',
        },
        platform: PlatformType.GITHUB,
        joinedAt: '2020-05-27T15:13:30Z',
      })

      const activityParent = {
        type: 'activity',
        timestamp: '2020-05-27T14:13:30Z',
        platform: PlatformType.GITHUB,
        crowdInfo: {
          replies: 12,
          body: 'Some Parent Activity',
          repo: 'https://github.com/CrowdDevHQ/crowd-web',
        },
        isKeyAction: true,
        communityMember: memberCreated.id,
        score: 1,
        sourceId: '#sourceId1',
      }

      let activityParentCreated = await ActivityRepository.create(
        activityParent,
        mockIRepositoryOptions,
      )

      const activityChild = {
        type: 'activity',
        timestamp: '2020-05-27T15:13:30Z',
        platform: PlatformType.GITHUB,
        crowdInfo: {
          replies: 12,
          body: 'Here',
        },
        isKeyAction: true,
        communityMember: memberCreated.id,
        score: 1,
        parent: activityParentCreated.id,
        sourceId: '#sourceId2',
      }

      let activityChildCreated = await ActivityRepository.create(
        activityChild,
        mockIRepositoryOptions,
      )

      const transaction = await SequelizeRepository.createTransaction(
        mockIRepositoryOptions.database,
      )

      await activityService.addToConversation(
        activityChildCreated.id,
        activityParentCreated.id,
        transaction,
      )

      const conversationCreated = (
        await new ConversationService(mockIRepositoryOptions).findAndCountAll({
          slug: 'some-parent-activity',
        })
      ).rows[0]

      await SequelizeRepository.commitTransaction(transaction)

      // get activities again
      activityChildCreated = await activityService.findById(activityChildCreated.id)
      activityParentCreated = await activityService.findById(activityParentCreated.id)

      // activities should belong to the newly created conversation
      expect(activityChildCreated.conversationId).toBe(conversationCreated.id)
      expect(activityParentCreated.conversationId).toBe(conversationCreated.id)

      expect(conversationCreated.published).toStrictEqual(false)
    })
  })
})