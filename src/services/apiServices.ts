import { OutcomeData } from './../redux/callState/asyncActionCreator';
import axios from 'axios';
import * as querystring from 'querystring';
import { ApiData, CountData, DonationGoal, Group, GroupIssues, VoterContact } from './../common/model';
import * as Constants from '../common/constants';
import { UserContactEvent } from '../redux/userStats';

export const getAllIssues = (address: string): Promise<ApiData> => {
  return axios.get(`${Constants.ISSUES_API_URL}${encodeURIComponent(address)}`)
    .then(response => Promise.resolve(response.data))
    .catch(e => Promise.reject(e));
};

export const getGroupIssues = (groupid: string, address: string): Promise<GroupIssues> => {
  return axios.get(
    `${Constants.GROUP_API_URL}/${groupid}/issues?address=${encodeURIComponent(address)}`,
    {
      headers: {'Cache-Control': 'max-age=0'}
    })
    .then(response => Promise.resolve(response.data))
    .catch(e => Promise.reject(e));
};

export const getCountData = (): Promise<CountData> => {
  return axios.get(`${Constants.COUNTS_API_URL}`)
    .then(response => Promise.resolve(response.data))
    .catch(e => Promise.reject(e));
};

interface BackfillData {
  stats: BackfillOutcome[];
}

interface BackfillOutcome {
  issueID: string;
  contactID: string;
  result: string;
  time: string;
}

export const postBackfillOutcomes = (data: UserContactEvent[], idToken: string) => {
  let postData: BackfillData = {stats: []};

  for (let i = 0; i < data.length; i++) {
    let timeInSeconds = Math.round(data[i].time / 1000);

    let outcome: BackfillOutcome = {
      issueID: data[i].issueid,
      contactID: data[i].contactid,
      result: data[i].result,
      time: timeInSeconds.toString(),
    };

    postData.stats.push(outcome);
  }

  return axios.post(
    `${Constants.STATS_API_URL}`,
    postData,
    {
      headers: {'Authorization': 'Bearer ' + idToken,
                'Content-Type': 'application/json; charset=utf-8'}
    })
  .then(response => {
    return Promise.resolve(null);
  }).catch(e => Promise.reject(e));
};

export interface RemoteUserStats {
  stats: CallStats;
  weeklyStreak: number;
}

export interface CallStats {
  contact: number;
  voicemail: number;
  unavailable: number;
}

export const getUserStats = (idToken: string) => {
  return axios.get(
    `${Constants.STATS_API_URL}`,
    {
      headers: {'Authorization': 'Bearer ' + idToken,
                'Content-Type': 'application/json; charset=utf-8'}
    })
  .then(response => {
    let userData = response.data as RemoteUserStats;
    return Promise.resolve(userData);
  }).catch(e => Promise.reject(e));
};

export const postOutcomeData = (data: OutcomeData) => {
  const postData = querystring.stringify({
    location: data.location,
    result: data.outcome,
    contactid: data.contactId,
    issueid: data.issueId,
    groupid: data.groupId,
    via: data.via,
    userid: data.userId
  });
  // console.log('postOutcomeData() posted data:', postData)
  return axios.post(
      `${Constants.REPORT_API_URL}`,
      postData,
      {
        headers: {'Content-Type': 'application/x-www-form-urlencoded'}
      })
    .then(response => {
      return Promise.resolve(null);
    }).catch(e => Promise.reject(e));
};

export const getDonations = (): Promise<DonationGoal> => {
  const donationUrl = `${Constants.DONATIONS_API_URL}`;
  return axios.get(`${donationUrl}`)
    .then(response => Promise.resolve(response.data))
    .catch(e => Promise.reject(e));
};

export const getGroup = (groupId: string): Promise<Group> => {
  const groupUrl = `${Constants.GROUP_API_URL}/${groupId}`;
  return axios.get(groupUrl)
    .then(response => Promise.resolve(response.data))
    .catch(e => Promise.reject(e));
};

export const getNextContact = (issueId: string): Promise<VoterContact[]> => {
  const contactsUrl = `${Constants.CONTACTS_API_URL}?issueID=${issueId}`;
  return axios.get(contactsUrl)
    .then(response => Promise.resolve(response.data))
    .catch(e => Promise.reject(e));
};
